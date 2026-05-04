/**
 * SRE incident-response tools.
 *
 * Feature #1: k8s_incident_snapshot
 *   First-minute triage in a single call. Replaces the dozen+ kubectl
 *   commands an on-call typically runs at the start of a page.
 *
 * Design principles:
 *   - Parallel collection with Promise.allSettled — a single section failing
 *     (e.g., metrics-server down, RBAC blocking webhooks) must NOT break
 *     the entire snapshot.
 *   - Each section reports its own status: ok | degraded | unavailable, with
 *     a reason when non-ok. The LLM can reason about partial data.
 *   - Output is shaped for LLM consumption: counts and groupings, not raw
 *     lists; deduplicated events with occurrence counts; capped sizes.
 *   - Read-only. Classified as safe under ALL protection modes.
 */

import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The K8sClient wrapper from this project. We type it loosely here because
 * we don't want a hard import dependency on the wrapper's internal shape
 * during this feature branch. The registration helper at the bottom of this
 * file accepts the existing client and adapts it.
 *
 * Required surface used by this module:
 *   - getCoreV1Api(): k8s.CoreV1Api
 *   - getAppsV1Api(): k8s.AppsV1Api
 *   - getAdmissionregistrationV1Api(): k8s.AdmissionregistrationV1Api
 *   - getApiregistrationV1Api(): k8s.ApiregistrationV1Api
 *   - getCurrentContext(): string
 */
export interface K8sClientLike {
  getCoreV1Api(): k8s.CoreV1Api;
  getAppsV1Api(): k8s.AppsV1Api;
  getAdmissionregistrationV1Api(): k8s.AdmissionregistrationV1Api;
  getApiregistrationV1Api(): k8s.ApiregistrationV1Api;
  getCurrentContext(): string;
}

type SectionStatus = 'ok' | 'degraded' | 'unavailable';

interface SectionResult<T> {
  status: SectionStatus;
  reason?: string;
  data?: T;
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

export const IncidentSnapshotInput = z.object({
  namespace: z
    .string()
    .optional()
    .describe(
      'Namespace to scope the snapshot to. If omitted, snapshot is cluster-wide.',
    ),
  since: z
    .string()
    .regex(/^\d+(s|m|h)$/)
    .default('15m')
    .describe(
      'Time window for recent events and changes. Format: <number><s|m|h>. Default: 15m.',
    ),
  includeControlPlane: z
    .boolean()
    .optional()
    .describe(
      'Include control-plane health (webhooks, APIServices). Defaults to true for cluster-wide, false for namespaced.',
    ),
  maxEvents: z.number().int().min(1).max(100).default(20),
  maxPodsPerCategory: z.number().int().min(1).max(50).default(10),
});

export type IncidentSnapshotInputT = z.infer<typeof IncidentSnapshotInput>;

// ---------------------------------------------------------------------------
// Output shape (documented for callers)
// ---------------------------------------------------------------------------

interface UnhealthyPodsData {
  totalUnhealthy: number;
  byFailureMode: Record<string, PodFailureGroup>;
}

interface RecentEventsData {
  windowSeconds: number;
  totalWarnings: number;
  topReasons: EventGroup[];
}

interface ActiveRolloutsData {
  stuck: RolloutInfo[];
  inProgress: RolloutInfo[];
}

interface NodePressureData {
  nodesWithPressure: NodePressureInfo[];
  unreachableNodes: string[];
}

interface ControlPlaneData {
  failingWebhooks: WebhookInfo[];
  unavailableApiServices: string[];
}

export interface IncidentSnapshot {
  meta: {
    context: string;
    scope: { namespace: string | null };
    window: string;
    generatedAt: string;
    durationMs: number;
  };
  summary: {
    severity: 'green' | 'yellow' | 'red';
    headline: string;
    flags: string[];
  };
  unhealthyPods: SectionResult<UnhealthyPodsData>;
  recentEvents: SectionResult<RecentEventsData>;
  activeRollouts: SectionResult<ActiveRolloutsData>;
  nodePressure: SectionResult<NodePressureData>;
  controlPlane: SectionResult<ControlPlaneData>;
}

interface PodFailureGroup {
  count: number;
  examples: Array<{
    name: string;
    namespace: string;
    reason: string;
    restartCount: number;
    age: string;
  }>;
}

interface EventGroup {
  reason: string;
  count: number;
  involvedKinds: string[];
  example: {
    message: string;
    object: string;
    lastSeen: string;
  };
}

interface RolloutInfo {
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet';
  namespace: string;
  name: string;
  ready: number;
  desired: number;
  ageSinceUpdate: string;
}

interface NodePressureInfo {
  name: string;
  conditions: string[]; // e.g., ["MemoryPressure", "DiskPressure"]
}

interface WebhookInfo {
  kind: 'ValidatingWebhookConfiguration' | 'MutatingWebhookConfiguration';
  name: string;
  failurePolicy: string;
  reason: string; // e.g., "no service backing", "endpoint unreachable"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DURATION_RE = /^(\d+)(s|m|h)$/;

function parseDurationSeconds(s: string): number {
  const m = DURATION_RE.exec(s);
  if (!m) throw new Error(`invalid duration: ${s}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    default:
      throw new Error(`invalid duration unit: ${m[2]}`);
  }
}

function ageFrom(date: Date | string | undefined): string {
  if (!date) return 'unknown';
  const t = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - t.getTime();
  if (ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

/**
 * Classify a pod by its dominant failure mode. Returns null if the pod is
 * healthy. Order matters here — CrashLoop and ImagePull take precedence over
 * generic "Error" because they're more actionable.
 */
function classifyPodFailure(pod: k8s.V1Pod): {
  mode: string;
  reason: string;
  restartCount: number;
} | null {
  const phase = pod.status?.phase ?? 'Unknown';
  const containerStatuses = pod.status?.containerStatuses ?? [];
  const initContainerStatuses = pod.status?.initContainerStatuses ?? [];
  const allStatuses = [...initContainerStatuses, ...containerStatuses];
  const restartCount = allStatuses.reduce(
    (n, c) => n + (c.restartCount ?? 0),
    0,
  );

  // Evicted pods
  if (phase === 'Failed' && pod.status?.reason === 'Evicted') {
    return { mode: 'Evicted', reason: 'Evicted', restartCount };
  }

  // Pending: scheduling or image issues
  if (phase === 'Pending') {
    const waiting = allStatuses.find((c) => c.state?.waiting?.reason);
    if (waiting?.state?.waiting?.reason) {
      const r = waiting.state.waiting.reason;
      if (r === 'ImagePullBackOff' || r === 'ErrImagePull') {
        return { mode: 'ImagePullBackOff', reason: r, restartCount };
      }
      if (r === 'CreateContainerConfigError') {
        return { mode: 'ConfigError', reason: r, restartCount };
      }
    }
    // Likely unschedulable
    return { mode: 'Pending', reason: 'Pending (scheduling)', restartCount };
  }

  // Running but with a container in trouble
  for (const c of allStatuses) {
    const w = c.state?.waiting;
    if (w?.reason === 'CrashLoopBackOff') {
      return {
        mode: 'CrashLoopBackOff',
        reason: w.message ?? 'CrashLoopBackOff',
        restartCount,
      };
    }
    if (
      w?.reason === 'ImagePullBackOff' ||
      w?.reason === 'ErrImagePull'
    ) {
      return { mode: 'ImagePullBackOff', reason: w.reason, restartCount };
    }
    const term = c.lastState?.terminated;
    if (term?.reason === 'OOMKilled') {
      return { mode: 'OOMKilled', reason: 'OOMKilled', restartCount };
    }
  }

  if (phase === 'Failed') {
    return {
      mode: 'Error',
      reason: pod.status?.reason ?? pod.status?.message ?? 'Failed',
      restartCount,
    };
  }

  return null; // healthy or transient
}

// ---------------------------------------------------------------------------
// Section collectors (each is independent, fault-tolerant)
// ---------------------------------------------------------------------------

async function collectUnhealthyPods(
  client: K8sClientLike,
  namespace: string | null,
  cap: number,
): Promise<SectionResult<UnhealthyPodsData>> {
  try {
    const core = client.getCoreV1Api();
    const list = namespace
      ? await core.listNamespacedPod({ namespace })
      : await core.listPodForAllNamespaces();

    const groups: Record<string, PodFailureGroup> = {};
    let total = 0;

    for (const pod of list.items) {
      const cls = classifyPodFailure(pod);
      if (!cls) continue;
      total++;
      const g = (groups[cls.mode] ??= { count: 0, examples: [] });
      g.count++;
      if (g.examples.length < cap) {
        g.examples.push({
          name: pod.metadata?.name ?? '?',
          namespace: pod.metadata?.namespace ?? '?',
          reason: cls.reason,
          restartCount: cls.restartCount,
          age: ageFrom(pod.metadata?.creationTimestamp),
        });
      }
    }

    return {
      status: 'ok',
      data: { totalUnhealthy: total, byFailureMode: groups },
    };
  } catch (err) {
    return {
      status: 'unavailable',
      reason: errMsg(err),
    };
  }
}

async function collectRecentEvents(
  client: K8sClientLike,
  namespace: string | null,
  windowSeconds: number,
  maxEvents: number,
): Promise<SectionResult<RecentEventsData>> {
  try {
    const core = client.getCoreV1Api();
    const list = namespace
      ? await core.listNamespacedEvent({
          namespace,
          fieldSelector: 'type=Warning',
        })
      : await core.listEventForAllNamespaces({
          fieldSelector: 'type=Warning',
        });

    const cutoff = Date.now() - windowSeconds * 1000;
    const recent = list.items.filter((ev) => {
      const t =
        ev.lastTimestamp ??
        ev.eventTime ??
        ev.metadata?.creationTimestamp;
      if (!t) return false;
      return new Date(t).getTime() >= cutoff;
    });

    // Group by reason
    const byReason = new Map<
      string,
      {
        count: number;
        kinds: Set<string>;
        latest: k8s.CoreV1Event;
        latestTs: number;
      }
    >();

    for (const ev of recent) {
      const reason = ev.reason ?? 'Unknown';
      const kind = ev.involvedObject?.kind ?? 'Unknown';
      const ts = new Date(
        ev.lastTimestamp ??
          ev.eventTime ??
          ev.metadata?.creationTimestamp ??
          0,
      ).getTime();
      const cur = byReason.get(reason);
      if (!cur) {
        byReason.set(reason, {
          count: ev.count ?? 1,
          kinds: new Set([kind]),
          latest: ev,
          latestTs: ts,
        });
      } else {
        cur.count += ev.count ?? 1;
        cur.kinds.add(kind);
        if (ts > cur.latestTs) {
          cur.latest = ev;
          cur.latestTs = ts;
        }
      }
    }

    const topReasons: EventGroup[] = [...byReason.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, maxEvents)
      .map(([reason, g]) => ({
        reason,
        count: g.count,
        involvedKinds: [...g.kinds],
        example: {
          message: (g.latest.message ?? '').slice(0, 240),
          object: `${g.latest.involvedObject?.kind ?? '?'}/${
            g.latest.involvedObject?.name ?? '?'
          }${
            g.latest.involvedObject?.namespace
              ? ` (ns=${g.latest.involvedObject.namespace})`
              : ''
          }`,
          lastSeen: ageFrom(new Date(g.latestTs)),
        },
      }));

    return {
      status: 'ok',
      data: {
        windowSeconds,
        totalWarnings: recent.reduce((n, e) => n + (e.count ?? 1), 0),
        topReasons,
      },
    };
  } catch (err) {
    return { status: 'unavailable', reason: errMsg(err) };
  }
}

async function collectActiveRollouts(
  client: K8sClientLike,
  namespace: string | null,
  windowSeconds: number,
): Promise<SectionResult<ActiveRolloutsData>> {
  try {
    const apps = client.getAppsV1Api();
    const [deploys, stsList, dsList] = await Promise.all([
      namespace
        ? apps.listNamespacedDeployment({ namespace })
        : apps.listDeploymentForAllNamespaces(),
      namespace
        ? apps.listNamespacedStatefulSet({ namespace })
        : apps.listStatefulSetForAllNamespaces(),
      namespace
        ? apps.listNamespacedDaemonSet({ namespace })
        : apps.listDaemonSetForAllNamespaces(),
    ]);

    const stuck: RolloutInfo[] = [];
    const inProgress: RolloutInfo[] = [];
    const stuckThresholdSec = Math.max(windowSeconds, 600); // ≥10 min counts as stuck

    for (const d of deploys.items) {
      const ready = d.status?.readyReplicas ?? 0;
      const desired = d.spec?.replicas ?? 0;
      if (ready === desired) continue;
      const lastUpdate =
        d.status?.conditions?.find((c) => c.type === 'Progressing')
          ?.lastUpdateTime ?? d.metadata?.creationTimestamp;
      const ageSec = lastUpdate
        ? (Date.now() - new Date(lastUpdate).getTime()) / 1000
        : 0;
      const info: RolloutInfo = {
        kind: 'Deployment',
        namespace: d.metadata?.namespace ?? '?',
        name: d.metadata?.name ?? '?',
        ready,
        desired,
        ageSinceUpdate: ageFrom(lastUpdate),
      };
      (ageSec > stuckThresholdSec ? stuck : inProgress).push(info);
    }

    for (const s of stsList.items) {
      const ready = s.status?.readyReplicas ?? 0;
      const desired = s.spec?.replicas ?? 0;
      if (ready === desired) continue;
      const lastUpdate = s.metadata?.creationTimestamp;
      const ageSec = lastUpdate
        ? (Date.now() - new Date(lastUpdate).getTime()) / 1000
        : 0;
      const info: RolloutInfo = {
        kind: 'StatefulSet',
        namespace: s.metadata?.namespace ?? '?',
        name: s.metadata?.name ?? '?',
        ready,
        desired,
        ageSinceUpdate: ageFrom(lastUpdate),
      };
      (ageSec > stuckThresholdSec ? stuck : inProgress).push(info);
    }

    for (const ds of dsList.items) {
      const ready = ds.status?.numberReady ?? 0;
      const desired = ds.status?.desiredNumberScheduled ?? 0;
      if (ready === desired) continue;
      const info: RolloutInfo = {
        kind: 'DaemonSet',
        namespace: ds.metadata?.namespace ?? '?',
        name: ds.metadata?.name ?? '?',
        ready,
        desired,
        ageSinceUpdate: ageFrom(ds.metadata?.creationTimestamp),
      };
      inProgress.push(info);
    }

    return { status: 'ok', data: { stuck, inProgress } };
  } catch (err) {
    return { status: 'unavailable', reason: errMsg(err) };
  }
}

async function collectNodePressure(
  client: K8sClientLike,
): Promise<SectionResult<NodePressureData>> {
  try {
    const core = client.getCoreV1Api();
    const list = await core.listNode();
    const nodesWithPressure: NodePressureInfo[] = [];
    const unreachableNodes: string[] = [];

    for (const node of list.items) {
      const conds = node.status?.conditions ?? [];
      const ready = conds.find((c) => c.type === 'Ready');
      if (ready && ready.status !== 'True') {
        unreachableNodes.push(node.metadata?.name ?? '?');
        continue;
      }
      const pressure: string[] = [];
      for (const c of conds) {
        if (
          (c.type === 'MemoryPressure' ||
            c.type === 'DiskPressure' ||
            c.type === 'PIDPressure' ||
            c.type === 'NetworkUnavailable') &&
          c.status === 'True'
        ) {
          pressure.push(c.type);
        }
      }
      if (pressure.length) {
        nodesWithPressure.push({
          name: node.metadata?.name ?? '?',
          conditions: pressure,
        });
      }
    }

    return { status: 'ok', data: { nodesWithPressure, unreachableNodes } };
  } catch (err) {
    return { status: 'unavailable', reason: errMsg(err) };
  }
}

async function collectControlPlane(
  client: K8sClientLike,
): Promise<SectionResult<ControlPlaneData>> {
  try {
    const failingWebhooks: WebhookInfo[] = [];
    const unavailableApiServices: string[] = [];

    // Webhooks: configurations exist but reference services that don't, or have failurePolicy=Fail with no health
    const adm = client.getAdmissionregistrationV1Api();
    const [vw, mw] = await Promise.all([
      adm.listValidatingWebhookConfiguration().catch(() => null),
      adm.listMutatingWebhookConfiguration().catch(() => null),
    ]);

    const checkSvc = async (
      svc: { name?: string; namespace?: string; path?: string } | undefined,
    ): Promise<string | null> => {
      if (!svc?.name || !svc.namespace) return null;
      try {
        const core = client.getCoreV1Api();
        await core.readNamespacedService({
          name: svc.name,
          namespace: svc.namespace,
        });
        return null;
      } catch {
        return `service ${svc.namespace}/${svc.name} not found`;
      }
    };

    if (vw) {
      for (const cfg of vw.items) {
        for (const wh of cfg.webhooks ?? []) {
          if (wh.failurePolicy !== 'Fail') continue;
          const reason = await checkSvc(wh.clientConfig?.service);
          if (reason) {
            failingWebhooks.push({
              kind: 'ValidatingWebhookConfiguration',
              name: `${cfg.metadata?.name ?? '?'}/${wh.name}`,
              failurePolicy: wh.failurePolicy ?? 'Fail',
              reason,
            });
          }
        }
      }
    }
    if (mw) {
      for (const cfg of mw.items) {
        for (const wh of cfg.webhooks ?? []) {
          if (wh.failurePolicy !== 'Fail') continue;
          const reason = await checkSvc(wh.clientConfig?.service);
          if (reason) {
            failingWebhooks.push({
              kind: 'MutatingWebhookConfiguration',
              name: `${cfg.metadata?.name ?? '?'}/${wh.name}`,
              failurePolicy: wh.failurePolicy ?? 'Fail',
              reason,
            });
          }
        }
      }
    }

    // APIServices reporting Available=False
    try {
      const reg = client.getApiregistrationV1Api();
      const list = await reg.listAPIService();
      for (const svc of list.items) {
        const cond = svc.status?.conditions?.find(
          (c) => c.type === 'Available',
        );
        if (cond && cond.status !== 'True') {
          unavailableApiServices.push(
            `${svc.metadata?.name ?? '?'} (${cond.reason ?? 'unknown'})`,
          );
        }
      }
    } catch {
      // Apiregistration may not be reachable; not fatal
    }

    const status: SectionStatus =
      failingWebhooks.length || unavailableApiServices.length
        ? 'degraded'
        : 'ok';
    return {
      status,
      data: { failingWebhooks, unavailableApiServices },
    };
  } catch (err) {
    return { status: 'unavailable', reason: errMsg(err) };
  }
}

// ---------------------------------------------------------------------------
// Severity scoring + headline generation
// ---------------------------------------------------------------------------

function computeSummary(snap: IncidentSnapshot): IncidentSnapshot['summary'] {
  const flags: string[] = [];
  let severity: 'green' | 'yellow' | 'red' = 'green';

  const up = snap.unhealthyPods.data;
  if (up && up.totalUnhealthy > 0) {
    const modes = Object.keys(up.byFailureMode);
    flags.push(`${up.totalUnhealthy} unhealthy pods (${modes.join(', ')})`);
    severity = up.totalUnhealthy > 5 ? 'red' : 'yellow';
  }

  const ev = snap.recentEvents.data;
  if (ev && ev.totalWarnings > 20) {
    flags.push(`${ev.totalWarnings} warning events in window`);
    severity = severity === 'green' ? 'yellow' : severity;
  }

  const ro = snap.activeRollouts.data;
  if (ro && ro.stuck.length > 0) {
    flags.push(`${ro.stuck.length} stuck rollout(s)`);
    severity = 'red';
  }

  const np = snap.nodePressure.data;
  if (np && (np.nodesWithPressure.length || np.unreachableNodes.length)) {
    flags.push(
      `${np.unreachableNodes.length} unreachable node(s), ${np.nodesWithPressure.length} under pressure`,
    );
    severity = 'red';
  }

  const cp = snap.controlPlane.data;
  if (cp && (cp.failingWebhooks.length || cp.unavailableApiServices.length)) {
    flags.push(
      `${cp.failingWebhooks.length} failing webhook(s), ${cp.unavailableApiServices.length} unavailable APIService(s)`,
    );
    severity = 'red';
  }

  const headline =
    flags.length === 0
      ? 'No incident-level issues detected in the snapshot window.'
      : flags.join('; ');

  return { severity, headline, flags };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runIncidentSnapshot(
  client: K8sClientLike,
  rawInput: unknown,
): Promise<IncidentSnapshot> {
  const input = IncidentSnapshotInput.parse(rawInput);
  const startedAt = Date.now();
  const ns = input.namespace ?? null;
  const windowSeconds = parseDurationSeconds(input.since);
  const includeCP =
    input.includeControlPlane ?? ns === null; // default: yes for cluster-wide

  // Run collectors in parallel; a failure in one does not block others.
  const [unhealthy, events, rollouts, nodes, controlPlane] = await Promise.all([
    collectUnhealthyPods(client, ns, input.maxPodsPerCategory),
    collectRecentEvents(client, ns, windowSeconds, input.maxEvents),
    collectActiveRollouts(client, ns, windowSeconds),
    collectNodePressure(client),
    includeCP
      ? collectControlPlane(client)
      : Promise.resolve<SectionResult<ControlPlaneData>>({
          status: 'ok',
          data: { failingWebhooks: [], unavailableApiServices: [] },
          reason: 'skipped (namespaced scope)',
        }),
  ]);

  const snap: IncidentSnapshot = {
    meta: {
      context: safeCall(() => client.getCurrentContext(), 'unknown'),
      scope: { namespace: ns },
      window: input.since,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    summary: { severity: 'green', headline: '', flags: [] },
    unhealthyPods: unhealthy,
    recentEvents: events,
    activeRollouts: rollouts,
    nodePressure: nodes,
    controlPlane,
  };

  snap.summary = computeSummary(snap);
  return snap;
}

// ---------------------------------------------------------------------------
// MCP tool registration
// ---------------------------------------------------------------------------

/**
 * Register the incident-snapshot tool on an MCP server.
 *
 * Integration: call this from your existing tool-registration entry point
 * (likely in src/index.ts or src/server.ts), passing your K8sClient instance.
 *
 *   import { registerIncidentTools } from './incident.js';
 *   registerIncidentTools(server, k8sClient);
 *
 * The tool is read-only and is allowed under all three protection modes
 * (Infrastructure, Strict, NoDelete).
 */
export function registerIncidentTools(
  server: McpServer,
  client: K8sClientLike,
): void {
  server.registerTool(
    'k8s_incident_snapshot',
    {
      title: 'Incident Snapshot',
      description:
        'First-minute SRE triage in a single call. Returns unhealthy pods grouped by failure mode, recent warning events, active and stuck rollouts, node pressure, and control-plane health (webhooks + APIServices). Read-only; safe under all protection modes. Use this at the start of any incident instead of running a dozen kubectl commands.',
      inputSchema: IncidentSnapshotInput.shape,
    },
    async (args: unknown) => {
      const snap = await runIncidentSnapshot(client, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(snap, null, 2),
          },
        ],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Tiny utilities
// ---------------------------------------------------------------------------

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}