import * as k8s from "@kubernetes/client-node";
import { K8sClient } from "../k8s-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { classifyError, ErrorContext } from "../error-handling.js";

/**
 * Registers the k8s_changes_since SRE tool.
 *
 * Returns a time-windowed diff of cluster state: resources created, modified,
 * or being deleted within the window, with who-did-what attribution from
 * metadata.managedFields[].time. Also returns relevant cluster events
 * (scaling, image updates, rollbacks).
 *
 * Read-only. Safe under all protection modes.
 *
 * Limitations: full audit-log integration is out of scope (requires API
 * server audit policy + log access). This tool relies on:
 *   - metadata.creationTimestamp           → newly created resources
 *   - metadata.managedFields[].time        → most recent modifier
 *   - metadata.deletionTimestamp           → resources being deleted
 *   - Events of type Normal                → scaling, image updates
 */
export function registerChangesSinceTools(
  k8sClient: K8sClient,
): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_changes_since",
        description:
          "Returns a time-windowed diff of cluster state. Lists resources created, modified, or being deleted within the window across 9 kinds (Deployment, StatefulSet, DaemonSet, ConfigMap, Secret, RoleBinding, ClusterRoleBinding, HorizontalPodAutoscaler, Service), with who-did-what attribution from managedFields. Also includes scaling and configuration events. Use during incident triage to answer 'what changed?'. Read-only and safe under all protection modes.",
        inputSchema: {
          type: "object",
          properties: {
            since: {
              type: "string",
              description:
                "Time window for changes, e.g. '5m', '15m', '1h', '24h'. Defaults to '1h'.",
              default: "1h",
            },
            namespace: {
              type: "string",
              description:
                "Limit to a single namespace. Omit for cluster-wide scope.",
            },
            kinds: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "Deployment",
                  "StatefulSet",
                  "DaemonSet",
                  "ConfigMap",
                  "Secret",
                  "RoleBinding",
                  "ClusterRoleBinding",
                  "HorizontalPodAutoscaler",
                  "Service",
                ],
              },
              description:
                "Filter to specific resource kinds. Omit to scan all 9 supported kinds.",
            },
            maxResults: {
              type: "number",
              description:
                "Maximum number of resource changes to return. Defaults to 50.",
              default: 50,
            },
            includeEvents: {
              type: "boolean",
              description:
                "Whether to include relevant cluster events (scaling, image updates, etc.). Defaults to true.",
              default: true,
            },
          },
        },
      },
      handler: async ({
        since,
        namespace,
        kinds,
        maxResults,
        includeEvents,
      }: {
        since?: string;
        namespace?: string;
        kinds?: string[];
        maxResults?: number;
        includeEvents?: boolean;
      }) => {
        const startedAt = Date.now();
        const ns = namespace ?? null;
        const window = since ?? "1h";
        const windowSeconds = parseDurationSeconds(window);
        const cap = maxResults ?? 50;
        const wantEvents = includeEvents ?? true;
        const kindFilter = (kinds ?? []) as KindName[];

        const [resources, events] = await Promise.all([
          collectResourceChanges(k8sClient, ns, windowSeconds, kindFilter, cap),
          wantEvents
            ? collectChangeEvents(k8sClient, ns, windowSeconds, cap)
            : Promise.resolve<SectionResult<ChangeEvent[]>>({
                status: "ok",
                data: [],
              }),
        ]);

        const byKind: Record<string, number> = {};
        const byActor: Record<string, number> = {};
        for (const r of resources.data ?? []) {
          byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
          if (r.modifiedBy) {
            byActor[r.modifiedBy] = (byActor[r.modifiedBy] ?? 0) + 1;
          }
        }

        return {
          meta: {
            scope: { namespace: ns },
            window,
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          },
          summary: {
            totalChanges:
              (resources.data?.length ?? 0) + (events.data?.length ?? 0),
            byKind,
            byActor,
          },
          resources,
          events,
        };
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KindName =
  | "Deployment"
  | "StatefulSet"
  | "DaemonSet"
  | "ConfigMap"
  | "Secret"
  | "RoleBinding"
  | "ClusterRoleBinding"
  | "HorizontalPodAutoscaler"
  | "Service";

type SectionStatus = "ok" | "degraded" | "unavailable";

interface SectionResult<T> {
  status: SectionStatus;
  reason?: string;
  data?: T;
}

interface ResourceChange {
  kind: string;
  namespace: string | null;
  name: string;
  changeType: "created" | "modified" | "deleting";
  ageOfChange: string;
  modifiedBy?: string;
  operation?: string;
}

interface ChangeEvent {
  reason: string;
  object: string;
  message: string;
  age: string;
}

/** Loose metadata shape that accepts both string and Date timestamps. */
export interface LooseObjectMeta {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: Date | string;
    deletionTimestamp?: Date | string;
    managedFields?: Array<{
      manager?: string;
      operation?: string;
      time?: Date | string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

export function parseDurationSeconds(s: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(s);
  if (!m) return 3600;
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
      return 3600;
  }
}

export function ageFrom(date: Date | string | undefined): string {
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

export function withinWindow(
  ts: Date | string | undefined,
  windowSeconds: number,
): boolean {
  if (!ts) return false;
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts.getTime();
  return Date.now() - t <= windowSeconds * 1000;
}

export function mostRecentManagedField(
  obj: LooseObjectMeta | undefined,
): { manager: string; operation: string; time: Date } | null {
  const fields = obj?.metadata?.managedFields ?? [];
  let best: { manager: string; operation: string; time: Date } | null = null;
  for (const f of fields) {
    if (!f.time) continue;
    const t = new Date(f.time);
    if (!best || t > best.time) {
      best = {
        manager: f.manager ?? "unknown",
        operation: f.operation ?? "unknown",
        time: t,
      };
    }
  }
  return best;
}

/**
 * Inspect a Kubernetes object's metadata and decide whether it changed
 * within the given window. Returns null if the object did not change in
 * the window. Exported for testing.
 */
export function changeFromMeta(
  obj: LooseObjectMeta | undefined,
  kind: string,
  windowSeconds: number,
  namespaced: boolean,
): ResourceChange | null {
  const meta = obj?.metadata;
  if (!meta) return null;
  const created = meta.creationTimestamp;
  const deleting = meta.deletionTimestamp;

  if (deleting && withinWindow(deleting, windowSeconds)) {
    return {
      kind,
      namespace: namespaced ? (meta.namespace ?? null) : null,
      name: meta.name ?? "?",
      changeType: "deleting",
      ageOfChange: ageFrom(deleting),
      modifiedBy: "unknown",
    };
  }
  if (created && withinWindow(created, windowSeconds)) {
    const mgr = mostRecentManagedField(obj);
    return {
      kind,
      namespace: namespaced ? (meta.namespace ?? null) : null,
      name: meta.name ?? "?",
      changeType: "created",
      ageOfChange: ageFrom(created),
      modifiedBy: mgr?.manager,
      operation: mgr?.operation,
    };
  }
  const mgr = mostRecentManagedField(obj);
  if (mgr && withinWindow(mgr.time, windowSeconds)) {
    return {
      kind,
      namespace: namespaced ? (meta.namespace ?? null) : null,
      name: meta.name ?? "?",
      changeType: "modified",
      ageOfChange: ageFrom(mgr.time),
      modifiedBy: mgr.manager,
      operation: mgr.operation,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section collectors
// ---------------------------------------------------------------------------

async function collectResourceChanges(
  k8sClient: K8sClient,
  namespace: string | null,
  windowSeconds: number,
  kinds: KindName[],
  cap: number,
): Promise<SectionResult<ResourceChange[]>> {
  try {
    const apps = k8sClient.getAppsV1Api();
    const core = k8sClient.getCoreV1Api();
    const all: ResourceChange[] = [];
    const tasks: Array<Promise<void>> = [];
    const want = (k: KindName): boolean =>
      kinds.length === 0 || kinds.includes(k);

    if (want("Deployment")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await apps.listNamespacedDeployment({ namespace })
            : await apps.listDeploymentForAllNamespaces();
          for (const d of list.items) {
            const ch = changeFromMeta(d, "Deployment", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }
    if (want("StatefulSet")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await apps.listNamespacedStatefulSet({ namespace })
            : await apps.listStatefulSetForAllNamespaces();
          for (const s of list.items) {
            const ch = changeFromMeta(s, "StatefulSet", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }
    if (want("DaemonSet")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await apps.listNamespacedDaemonSet({ namespace })
            : await apps.listDaemonSetForAllNamespaces();
          for (const d of list.items) {
            const ch = changeFromMeta(d, "DaemonSet", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }
    if (want("ConfigMap")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await core.listNamespacedConfigMap({ namespace })
            : await core.listConfigMapForAllNamespaces();
          for (const c of list.items) {
            const ch = changeFromMeta(c, "ConfigMap", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }
    if (want("Secret")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await core.listNamespacedSecret({ namespace })
            : await core.listSecretForAllNamespaces();
          for (const s of list.items) {
            // Skip token Secrets; they auto-rotate and dominate output
            if (s.type === "kubernetes.io/service-account-token") continue;
            const ch = changeFromMeta(s, "Secret", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }
    if (want("Service")) {
      tasks.push(
        (async () => {
          const list = namespace
            ? await core.listNamespacedService({ namespace })
            : await core.listServiceForAllNamespaces();
          for (const s of list.items) {
            const ch = changeFromMeta(s, "Service", windowSeconds, true);
            if (ch) all.push(ch);
          }
        })(),
      );
    }

    if (want("RoleBinding")) {
      tasks.push(
        (async () => {
          try {
            const rbac = k8sClient.getRbacV1Api();
            const list = namespace
              ? await rbac.listNamespacedRoleBinding({ namespace })
              : await rbac.listRoleBindingForAllNamespaces();
            for (const r of list.items) {
              const ch = changeFromMeta(r, "RoleBinding", windowSeconds, true);
              if (ch) all.push(ch);
            }
          } catch {
            /* RBAC API may not be reachable */
          }
        })(),
      );
    }
    if (want("ClusterRoleBinding")) {
      tasks.push(
        (async () => {
          try {
            const rbac = k8sClient.getRbacV1Api();
            const list = await rbac.listClusterRoleBinding();
            for (const r of list.items) {
              const ch = changeFromMeta(
                r,
                "ClusterRoleBinding",
                windowSeconds,
                false,
              );
              if (ch) all.push(ch);
            }
          } catch {
            /* RBAC API may not be reachable */
          }
        })(),
      );
    }
    if (want("HorizontalPodAutoscaler")) {
      tasks.push(
        (async () => {
          try {
            const hpa = k8sClient.getAutoscalingV2Api();
            const list = namespace
              ? await hpa.listNamespacedHorizontalPodAutoscaler({ namespace })
              : await hpa.listHorizontalPodAutoscalerForAllNamespaces();
            for (const h of list.items) {
              const ch = changeFromMeta(
                h,
                "HorizontalPodAutoscaler",
                windowSeconds,
                true,
              );
              if (ch) all.push(ch);
            }
          } catch {
            /* HPA API may not be reachable */
          }
        })(),
      );
    }

    await Promise.allSettled(tasks);
    return { status: "ok", data: all.slice(0, cap) };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_changes_since.resources",
      namespace: namespace ?? undefined,
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}

async function collectChangeEvents(
  k8sClient: K8sClient,
  namespace: string | null,
  windowSeconds: number,
  cap: number,
): Promise<SectionResult<ChangeEvent[]>> {
  try {
    const events = await k8sClient.listEvents(namespace ?? undefined);
    const interestingReasons = new Set([
      "ScalingReplicaSet",
      "SuccessfulCreate",
      "SuccessfulDelete",
      "Killing",
      "Started",
      "Pulled",
      "Created",
      "DeploymentRollback",
      "Updated",
    ]);
    const out: ChangeEvent[] = [];
    for (const ev of events) {
      const t =
        ev.lastTimestamp ?? ev.eventTime ?? ev.metadata?.creationTimestamp;
      if (!t || !withinWindow(t, windowSeconds)) continue;
      if (!ev.reason || !interestingReasons.has(ev.reason)) continue;
      out.push({
        reason: ev.reason,
        object: `${ev.involvedObject?.kind ?? "?"}/${
          ev.involvedObject?.name ?? "?"
        }${
          ev.involvedObject?.namespace
            ? ` (ns=${ev.involvedObject.namespace})`
            : ""
        }`,
        message: (ev.message ?? "").slice(0, 240),
        age: ageFrom(t),
      });
      if (out.length >= cap) break;
    }
    return { status: "ok", data: out };
  } catch (err) {
    const ctx: ErrorContext = {
      operation: "k8s_changes_since.events",
      namespace: namespace ?? undefined,
    };
    const classified = classifyError(err, ctx);
    return { status: "unavailable", reason: classified.message };
  }
}
