import * as k8s from "@kubernetes/client-node";
import { K8sClient } from "../k8s-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { classifyError, ErrorContext } from "../error-handling.js";

/**
 * Registers SRE workflow tools.
 *
 * Currently exposes:
 *   - k8s_incident_snapshot — first-minute SRE triage in one call.
 *
 * Read-only. Safe under all protection modes (Infrastructure, Strict,
 * No-Delete). The tool only performs list/get/read operations against the
 * Kubernetes API and does not mutate cluster state.
 */
export function registerIncidentSnapshotTools(
  k8sClient: K8sClient,
): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_incident_snapshot",
        description:
          "First-minute SRE triage in one call. Returns unhealthy pods grouped by failure mode (CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending, Evicted), recent warning events grouped by reason, active and stuck rollouts, node pressure (Ready/MemoryPressure/DiskPressure/PIDPressure), and control-plane health (failing webhooks and unavailable APIServices). Output includes a severity headline (green/yellow/red). Read-only and safe under all protection modes.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description:
                "Limit pod, event, and rollout collection to a single namespace. Omit for cluster-wide scope. Control-plane checks always run cluster-wide unless includeControlPlane is false.",
            },
            since: {
              type: "string",
              description:
                "Time window for events and rollout staleness, e.g. '5m', '15m', '1h', '24h'. Defaults to '15m'.",
              default: "15m",
            },
            includeControlPlane: {
              type: "boolean",
              description:
                "Whether to check failing webhooks and unavailable APIServices. Defaults to true when scope is cluster-wide, false when a namespace is specified.",
            },
            maxEvents: {
              type: "number",
              description:
                "Maximum number of distinct event reasons to return in topReasons. Defaults to 20.",
              default: 20,
            },
            maxPodsPerCategory: {
              type: "number",
              description:
                "Maximum example pods returned per failure-mode group. Defaults to 10.",
              default: 10,
            },
          },
        },
      },
      handler: async ({
        namespace,
        since,
        includeControlPlane,
        maxEvents,
        maxPodsPerCategory,
      }: {
        namespace?: string;
        since?: string;
        includeControlPlane?: boolean;
        maxEvents?: number;
        maxPodsPerCategory?: number;
      }) => {
        const startedAt = Date.now();
        const ns = namespace ?? null;
        const window = since ?? "15m";
        const windowSeconds = parseDurationSeconds(window);
        const cap = maxPodsPerCategory ?? 10;
        const eventCap = maxEvents ?? 20;
        const includeCP = includeControlPlane ?? ns === null;

        const [unhealthy, events, rollouts, nodes, controlPlane] =
          await Promise.all([
            collectUnhealthyPods(k8sClient, ns, cap),
            collectRecentEvents(k8sClient, ns, windowSeconds, eventCap),
            collectActiveRollouts(k8sClient, ns, windowSeconds),
            collectNodePressure(k8sClient),
            includeCP
              ? collectControlPlane(k8sClient)
              : Promise.resolve<SectionResult<ControlPlaneData>>({
                  status: "ok",
                  reason: "skipped (namespaced scope)",
                  data: { failingWebhooks: [], unavailableApiServices: [] },
                }),
          ]);

        const snapshot: IncidentSnapshot = {
          meta: {
            scope: { namespace: ns },
            window,
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          },
          summary: { severity: "green", headline: "", flags: [] },
          unhealthyPods: unhealthy,
          recentEvents: events,
          activeRollouts: rollouts,
          nodePressure: nodes,
          controlPlane,
        };
        snapshot.summary = computeSummary(snapshot);
        return snapshot;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionStatus = "ok" | "degraded" | "unavailable";

interface SectionResult<T> {
  status: SectionStatus;
  reason?: string;
  data?: T;
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
  example: { message: string; object: string; lastSeen: string };
}

interface RolloutInfo {
  kind: "Deployment" | "StatefulSet" | "DaemonSet";
  namespace: string;
  name: string;
  ready: number;
  desired: number;
  ageSinceUpdate: string;
}

interface NodePressureInfo {
  name: string;
  conditions: string[];
}

interface WebhookInfo {
  kind: "ValidatingWebhookConfiguration" | "MutatingWebhookConfiguration";
  name: string;
  failurePolicy: string;
  reason: string;
}

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

interface IncidentSnapshot {
  meta: {
    scope: { namespace: string | null };
    window: string;
    generatedAt: string;
    durationMs: number;
  };
  summary: {
    severity: "green" | "yellow" | "red";
    headline: string;
    flags: string[];
  };
  unhealthyPods: SectionResult<UnhealthyPodsData>;
  recentEvents: SectionResult<RecentEventsData>;
  activeRollouts: SectionResult<ActiveRolloutsData>;
  nodePressure: SectionResult<NodePressureData>;
  controlPlane: SectionResult<ControlPlaneData>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDurationSeconds(s: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(s);
  if (!m) return 15 * 60;
  const n = Number(m[1]);
  switch (m[2]) {
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 3600;
    case "d":
      return n * 86400;
    default:
      return 15 * 60;
  }
}

function ageFrom(date: Date | string | undefined): string {
  if (!date) return "unknown";
  const t = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - t.getTime();
  if (ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

function classifyPodFailure(pod: k8s.V1Pod): {
  mode: string;
  reason: string;
  restartCount: number;
} | null {
  const phase = pod.status?.phase ?? "Unknown";
  const allStatuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];
  const restartCount = allStatuses.reduce(
    (n, c) => n + (c.restartCount ?? 0),
    0,
  );

  if (phase === "Failed" && pod.status?.reason === "Evicted") {
    return { mode: "Evicted", reason: "Evicted", restartCount };
  }
  if (phase === "Pending") {
    const waiting = allStatuses.find((c) => c.state?.waiting?.reason);
    const r = waiting?.state?.waiting?.reason;
    if (r === "ImagePullBackOff" || r === "ErrImagePull") {
      return { mode: "ImagePullBackOff", reason: r, restartCount };
    }
    if (r === "CreateContainerConfigError") {
      return { mode: "ConfigError", reason: r, restartCount };
    }
    return {
      mode: "Pending",
      reason: "Pending (scheduling)",
      restartCount,
    };
  }
  for (const c of allStatuses) {
    const w = c.state?.waiting;
    if (w?.reason === "CrashLoopBackOff") {
      return {
        mode: "CrashLoopBackOff",
        reason: w.message ?? "CrashLoopBackOff",
        restartCount,
      };
    }
    if (w?.reason === "ImagePullBackOff" || w?.reason === "ErrImagePull") {
      return { mode: "ImagePullBackOff", reason: w.reason, restartCount };
    }
    if (c.lastState?.terminated?.reason === "OOMKilled") {
      return { mode: "OOMKilled", reason: "OOMKilled", restartCount };
    }
  }
  if (phase === "Failed") {
    return {
      mode: "Error",
      reason: pod.status?.reason ?? pod.status?.message ?? "Failed",
      restartCount,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section collectors
// ---------------------------------------------------------------------------

async function collectUnhealthyPods(
  k8sClient: K8sClient,
  namespace: string | null,
  cap: number,
): Promise<SectionResult<UnhealthyPodsData>> {
  try {
    const pods = await k8sClient.listPods(namespace ?? undefined);
    const groups: Record<string, PodFailureGroup> = {};
    let total = 0;
    for (const pod of pods) {
      const cls = classifyPodFailure(pod);
      if (!cls) continue;
      total++;
      const g = (groups[cls.mode] ??= { count: 0, examples: [] });
      g.count++;
      if (g.examples.length < cap) {
        g.examples.push({
          name: pod.metadata?.name ?? "?",
          namespace: pod.metadata?.namespace ?? "?",
          reason: cls.reason,
          restartCount: cls.restartCount,
          age: ageFrom(pod.metadata?.creationTimestamp),
        });
      }
    }
    return {
      status: "ok",
      data: { totalUnhealthy: total, byFailureMode: groups },
    };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_incident_snapshot.unhealthyPods",
      namespace: namespace ?? undefined,
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

async function collectRecentEvents(
  k8sClient: K8sClient,
  namespace: string | null,
  windowSeconds: number,
  cap: number,
): Promise<SectionResult<RecentEventsData>> {
  try {
    const events = await k8sClient.listEvents(namespace ?? undefined);
    const cutoff = Date.now() - windowSeconds * 1000;
    const recent = events.filter((ev: k8s.CoreV1Event) => {
      if (ev.type !== "Warning") return false;
      const t =
        ev.lastTimestamp ?? ev.eventTime ?? ev.metadata?.creationTimestamp;
      return t && new Date(t).getTime() >= cutoff;
    });

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
      const reason = ev.reason ?? "Unknown";
      const kind = ev.involvedObject?.kind ?? "Unknown";
      const ts = new Date(
        ev.lastTimestamp ?? ev.eventTime ?? ev.metadata?.creationTimestamp ?? 0,
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
      .slice(0, cap)
      .map(([reason, g]) => ({
        reason,
        count: g.count,
        involvedKinds: [...g.kinds],
        example: {
          message: (g.latest.message ?? "").slice(0, 240),
          object: `${g.latest.involvedObject?.kind ?? "?"}/${
            g.latest.involvedObject?.name ?? "?"
          }${
            g.latest.involvedObject?.namespace
              ? ` (ns=${g.latest.involvedObject.namespace})`
              : ""
          }`,
          lastSeen: ageFrom(new Date(g.latestTs)),
        },
      }));

    return {
      status: "ok",
      data: {
        windowSeconds,
        totalWarnings: recent.reduce(
          (n, e) => n + (e.count ?? 1),
          0,
        ),
        topReasons,
      },
    };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_incident_snapshot.recentEvents",
      namespace: namespace ?? undefined,
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

async function collectActiveRollouts(
  k8sClient: K8sClient,
  namespace: string | null,
  windowSeconds: number,
): Promise<SectionResult<ActiveRolloutsData>> {
  try {
    const apps = k8sClient.getAppsV1Api();
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
    const stuckThresholdSec = Math.max(windowSeconds, 600);

    for (const d of deploys.items) {
      const ready = d.status?.readyReplicas ?? 0;
      const desired = d.spec?.replicas ?? 0;
      if (ready === desired) continue;
      const lastUpdate =
        d.status?.conditions?.find((c) => c.type === "Progressing")
          ?.lastUpdateTime ?? d.metadata?.creationTimestamp;
      const ageSec = lastUpdate
        ? (Date.now() - new Date(lastUpdate).getTime()) / 1000
        : 0;
      const info: RolloutInfo = {
        kind: "Deployment",
        namespace: d.metadata?.namespace ?? "?",
        name: d.metadata?.name ?? "?",
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
        kind: "StatefulSet",
        namespace: s.metadata?.namespace ?? "?",
        name: s.metadata?.name ?? "?",
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
      inProgress.push({
        kind: "DaemonSet",
        namespace: ds.metadata?.namespace ?? "?",
        name: ds.metadata?.name ?? "?",
        ready,
        desired,
        ageSinceUpdate: ageFrom(ds.metadata?.creationTimestamp),
      });
    }
    return { status: "ok", data: { stuck, inProgress } };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_incident_snapshot.activeRollouts",
      namespace: namespace ?? undefined,
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

async function collectNodePressure(
  k8sClient: K8sClient,
): Promise<SectionResult<NodePressureData>> {
  try {
    const list = await k8sClient.getCoreV1Api().listNode();
    const nodesWithPressure: NodePressureInfo[] = [];
    const unreachableNodes: string[] = [];
    for (const node of list.items) {
      const conds = node.status?.conditions ?? [];
      const ready = conds.find((c) => c.type === "Ready");
      if (ready && ready.status !== "True") {
        unreachableNodes.push(node.metadata?.name ?? "?");
        continue;
      }
      const pressure: string[] = [];
      for (const c of conds) {
        if (
          (c.type === "MemoryPressure" ||
            c.type === "DiskPressure" ||
            c.type === "PIDPressure" ||
            c.type === "NetworkUnavailable") &&
          c.status === "True"
        ) {
          pressure.push(c.type);
        }
      }
      if (pressure.length) {
        nodesWithPressure.push({
          name: node.metadata?.name ?? "?",
          conditions: pressure,
        });
      }
    }
    return {
      status: "ok",
      data: { nodesWithPressure, unreachableNodes },
    };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_incident_snapshot.nodePressure",
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

async function collectControlPlane(
  k8sClient: K8sClient,
): Promise<SectionResult<ControlPlaneData>> {
  try {
    const failingWebhooks: WebhookInfo[] = [];
    const unavailableApiServices: string[] = [];
    const core = k8sClient.getCoreV1Api();

    // Use kc.makeApiClient directly so we don't depend on K8sClient having
    // bespoke wrappers for these less-common APIs. The kc field is the
    // standard KubeConfig instance every K8sClient holds.
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    const adm = kc?.makeApiClient(k8s.AdmissionregistrationV1Api);
    const reg = kc?.makeApiClient(k8s.ApiregistrationV1Api);

    if (!adm || !reg) {
      return {
        status: "degraded",
        reason: "control-plane API clients unavailable",
        data: { failingWebhooks, unavailableApiServices },
      };
    }

    const [vw, mw] = await Promise.all([
      adm.listValidatingWebhookConfiguration().catch(() => null),
      adm.listMutatingWebhookConfiguration().catch(() => null),
    ]);

    const checkSvc = async (
      svc: { name?: string; namespace?: string } | undefined,
    ): Promise<string | null> => {
      if (!svc?.name || !svc.namespace) return null;
      try {
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
          if (wh.failurePolicy !== "Fail") continue;
          const reason = await checkSvc(wh.clientConfig?.service);
          if (reason) {
            failingWebhooks.push({
              kind: "ValidatingWebhookConfiguration",
              name: `${cfg.metadata?.name ?? "?"}/${wh.name}`,
              failurePolicy: wh.failurePolicy ?? "Fail",
              reason,
            });
          }
        }
      }
    }
    if (mw) {
      for (const cfg of mw.items) {
        for (const wh of cfg.webhooks ?? []) {
          if (wh.failurePolicy !== "Fail") continue;
          const reason = await checkSvc(wh.clientConfig?.service);
          if (reason) {
            failingWebhooks.push({
              kind: "MutatingWebhookConfiguration",
              name: `${cfg.metadata?.name ?? "?"}/${wh.name}`,
              failurePolicy: wh.failurePolicy ?? "Fail",
              reason,
            });
          }
        }
      }
    }

    try {
      const list = await reg.listAPIService();
      for (const svc of list.items) {
        const cond = svc.status?.conditions?.find(
          (c) => c.type === "Available",
        );
        if (cond && cond.status !== "True") {
          unavailableApiServices.push(
            `${svc.metadata?.name ?? "?"} (${cond.reason ?? "unknown"})`,
          );
        }
      }
    } catch {
      // APIRegistration may not be reachable; leave list empty.
    }

    const status: SectionStatus =
      failingWebhooks.length || unavailableApiServices.length
        ? "degraded"
        : "ok";
    return {
      status,
      data: { failingWebhooks, unavailableApiServices },
    };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_incident_snapshot.controlPlane",
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

// ---------------------------------------------------------------------------
// Severity scoring
// ---------------------------------------------------------------------------

function computeSummary(snap: IncidentSnapshot): IncidentSnapshot["summary"] {
  const flags: string[] = [];
  let severity: "green" | "yellow" | "red" = "green";

  const up = snap.unhealthyPods.data;
  if (up && up.totalUnhealthy > 0) {
    flags.push(
      `${up.totalUnhealthy} unhealthy pods (${Object.keys(up.byFailureMode).join(", ")})`,
    );
    severity = up.totalUnhealthy > 5 ? "red" : "yellow";
  }
  const ev = snap.recentEvents.data;
  if (ev && ev.totalWarnings > 20) {
    flags.push(`${ev.totalWarnings} warning events in window`);
    severity = severity === "green" ? "yellow" : severity;
  }
  const ro = snap.activeRollouts.data;
  if (ro && ro.stuck.length > 0) {
    flags.push(`${ro.stuck.length} stuck rollout(s)`);
    severity = "red";
  }
  const np = snap.nodePressure.data;
  if (np && (np.nodesWithPressure.length || np.unreachableNodes.length)) {
    flags.push(
      `${np.unreachableNodes.length} unreachable node(s), ${np.nodesWithPressure.length} under pressure`,
    );
    severity = "red";
  }
  const cp = snap.controlPlane.data;
  if (cp && (cp.failingWebhooks.length || cp.unavailableApiServices.length)) {
    flags.push(
      `${cp.failingWebhooks.length} failing webhook(s), ${cp.unavailableApiServices.length} unavailable APIService(s)`,
    );
    severity = "red";
  }
  return {
    severity,
    headline:
      flags.length === 0
        ? "No incident-level issues detected."
        : flags.join("; "),
    flags,
  };
}
