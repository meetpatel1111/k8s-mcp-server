import * as k8s from "@kubernetes/client-node";
import { K8sClient } from "../k8s-client.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { classifyError, ErrorContext } from "../error-handling.js";

/**
 * Registers the k8s_blast_radius SRE tool.
 *
 * Pre-flight simulator for destructive operations. Returns a structured
 * impact preview with safe/risky/unsafe verdict — without actually
 * executing the action.
 *
 * Supported actions:
 *   - drain    Lists pods to evict, last-replica risks, stateful workloads, orphans
 *   - cordon   Capacity loss assessment, remaining schedulable nodes
 *   - delete   Pods affected, dependent Services, PDB coverage, singleton risk
 *   - scale    PDB minAvailable violations, scale-to-zero, scale-up capacity
 *
 * Read-only by design. The user/LLM uses the verdict to decide whether to
 * proceed with the actual destructive operation via existing tools.
 */
export function registerBlastRadiusTools(
  k8sClient: K8sClient,
): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_blast_radius",
        description:
          "Pre-flight simulator for destructive Kubernetes operations. Analyzes the impact of drain/cordon/delete/scale BEFORE executing, returning safe/risky/unsafe verdict with structured reasons (PDB violations, last-replica risks, dependent Services, stateful workload concerns) and machine-readable details. Read-only by design — does NOT execute the action. Safe under all protection modes.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["drain", "cordon", "delete", "scale"],
              description:
                "The destructive action to simulate. drain/cordon require node; delete/scale require kind+name (and namespace).",
            },
            node: {
              type: "string",
              description: "Node name. Required for drain or cordon.",
            },
            kind: {
              type: "string",
              enum: ["Deployment", "StatefulSet", "DaemonSet", "Service"],
              description: "Resource kind. Required for delete or scale.",
            },
            name: {
              type: "string",
              description: "Resource name. Required for delete or scale.",
            },
            namespace: {
              type: "string",
              description:
                "Namespace of the resource. Defaults to 'default' for delete or scale.",
              default: "default",
            },
            replicas: {
              type: "number",
              description:
                "Target replica count. Required for scale.",
              minimum: 0,
            },
          },
          required: ["action"],
        },
      },
      handler: async (args: {
        action: "drain" | "cordon" | "delete" | "scale";
        node?: string;
        kind?: "Deployment" | "StatefulSet" | "DaemonSet" | "Service";
        name?: string;
        namespace?: string;
        replicas?: number;
      }) => {
        // Input validation
        if ((args.action === "drain" || args.action === "cordon") && !args.node) {
          return errorResult(args, "missing required parameter 'node' for action " + args.action);
        }
        if ((args.action === "delete" || args.action === "scale") && (!args.kind || !args.name)) {
          return errorResult(args, "missing required parameters 'kind' and 'name' for action " + args.action);
        }
        if (args.action === "scale" && args.replicas === undefined) {
          return errorResult(args, "missing required parameter 'replicas' for scale action");
        }

        const startedAt = Date.now();
        try {
          let result: BlastRadiusResult;
          switch (args.action) {
            case "drain":
              result = await analyzeDrain(k8sClient, args.node!);
              break;
            case "cordon":
              result = await analyzeCordon(k8sClient, args.node!);
              break;
            case "delete":
              result = await analyzeDelete(
                k8sClient,
                args.kind!,
                args.name!,
                args.namespace ?? "default",
              );
              break;
            case "scale":
              result = await analyzeScale(
                k8sClient,
                args.kind!,
                args.name!,
                args.namespace ?? "default",
                args.replicas!,
              );
              break;
          }
          result.meta.durationMs = Date.now() - startedAt;
          return result;
        } catch (err) {
          const ctx: ErrorContext = {
            operation: "k8s_blast_radius",
            resource: args.name,
            namespace: args.namespace,
          };
          const classified = classifyError(err, ctx);
          return {
            ...errorResult(args, classified.message),
            meta: {
              ...errorResult(args, classified.message).meta,
              durationMs: Date.now() - startedAt,
            },
          };
        }
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Public types (exported for testing)
// ---------------------------------------------------------------------------

export type Verdict = "safe" | "risky" | "unsafe";

export interface BlastRadiusResult {
  meta: {
    action: string;
    target: string;
    generatedAt: string;
    durationMs: number;
  };
  verdict: Verdict;
  reasons: string[];
  details: Record<string, unknown>;
}

export interface OwnerInfo {
  kind: string;
  name: string;
  uid?: string;
}

export interface PdbView {
  name: string;
  minAvailable?: number | string;
  selector?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Combine two verdicts, returning the more severe one.
 * Order: unsafe > risky > safe.
 */
export function escalateVerdict(a: Verdict, b: Verdict): Verdict {
  const rank: Record<Verdict, number> = { safe: 0, risky: 1, unsafe: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Find the controller (or first owner) from a list of owner references.
 * Returns null if no owners.
 */
export function topController(
  ownerReferences:
    | Array<{ kind?: string; name?: string; uid?: string; controller?: boolean }>
    | undefined,
): OwnerInfo | null {
  if (!ownerReferences || ownerReferences.length === 0) return null;
  const controller = ownerReferences.find((o) => o.controller);
  const o = controller ?? ownerReferences[0];
  return { kind: o.kind ?? "?", name: o.name ?? "?", uid: o.uid };
}

/**
 * Simple label selector match: every key in selector must appear in labels
 * with the same value. (Supports matchLabels only, not matchExpressions.)
 */
export function selectorMatches(
  labels: Record<string, string> | undefined,
  selector: Record<string, string> | undefined,
): boolean {
  if (!selector || Object.keys(selector).length === 0) return false;
  if (!labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

/**
 * Pure scale-action analysis. Given the current/target replica counts,
 * the workload's labels, and any PDBs in the same namespace, decide
 * the verdict and reasons.
 */
export function analyzeScaleParams(
  current: number,
  target: number,
  workloadLabels: Record<string, string> | undefined,
  pdbs: PdbView[],
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  let verdict: Verdict = "safe";

  if (target === current) {
    reasons.push("No-op (target equals current)");
    return { verdict, reasons };
  }

  if (target === 0) {
    reasons.push("Scaling to zero — workload will be unavailable");
    verdict = "unsafe";
    return { verdict, reasons };
  }

  if (target < current) {
    const removed = current - target;
    reasons.push(
      `Scaling down from ${current} to ${target} (removing ${removed} replica${removed === 1 ? "" : "s"})`,
    );
    verdict = escalateVerdict(verdict, "risky");

    for (const pdb of pdbs) {
      if (!selectorMatches(workloadLabels, pdb.selector)) continue;
      const min = pdb.minAvailable;
      if (typeof min === "number" && target < min) {
        reasons.push(
          `PDB '${pdb.name}' requires minAvailable=${min}; target ${target} violates it`,
        );
        verdict = "unsafe";
      }
    }
  } else {
    const added = target - current;
    reasons.push(
      `Scaling up from ${current} to ${target} (adding ${added} replica${added === 1 ? "" : "s"}) — capacity check recommended`,
    );
  }

  return { verdict, reasons };
}

/**
 * Pure cordon analysis: given the schedulable node count BEFORE cordon
 * and pod count on the target node, decide the verdict.
 */
export function analyzeCordonCapacity(
  schedulableNodes: number,
  podsOnTarget: number,
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  let verdict: Verdict = "safe";

  reasons.push(
    `${podsOnTarget} existing pod${podsOnTarget === 1 ? "" : "s"} continue running; only new schedules blocked`,
  );

  const remainingAfterCordon = schedulableNodes - 1;
  if (remainingAfterCordon < 1) {
    reasons.push(
      `Cordon would leave ${remainingAfterCordon} schedulable node(s) — cluster cannot accept new pods`,
    );
    verdict = "unsafe";
  } else if (remainingAfterCordon <= 2) {
    reasons.push(
      `Cordon will leave only ${remainingAfterCordon} schedulable node(s) — autoscaler may not be able to handle pod failures`,
    );
    verdict = "risky";
  }

  return { verdict, reasons };
}

/**
 * Pure drain analysis: given pod info on the node, decide the verdict.
 *
 * podsOnNode: pods currently on the target node.
 * lastReplicaControllers: list of "Kind/name" controllers whose pods on
 *   this node represent ALL their currently-ready replicas (i.e. drain
 *   would leave the workload with zero ready pods).
 * statefulPods: pods owned by a StatefulSet.
 * orphanPods: pods with no controller (won't be recreated).
 */
export function analyzeDrainPods(
  podsOnNode: number,
  lastReplicaControllers: string[],
  statefulPods: string[],
  orphanPods: string[],
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  let verdict: Verdict = "safe";

  if (podsOnNode === 0) {
    reasons.push("No pods on node — drain has no impact");
    return { verdict, reasons };
  }

  reasons.push(`${podsOnNode} pod${podsOnNode === 1 ? "" : "s"} would be evicted`);
  verdict = escalateVerdict(verdict, "risky");

  if (orphanPods.length > 0) {
    reasons.push(
      `${orphanPods.length} orphan pod${orphanPods.length === 1 ? "" : "s"} on node will be lost (no controller to recreate)`,
    );
    verdict = "unsafe";
  }

  if (statefulPods.length > 0) {
    reasons.push(
      `${statefulPods.length} StatefulSet pod${statefulPods.length === 1 ? "" : "s"} on node — verify quorum and storage before draining`,
    );
    verdict = escalateVerdict(verdict, "risky");
  }

  if (lastReplicaControllers.length > 0) {
    reasons.push(
      `${lastReplicaControllers.length} workload${lastReplicaControllers.length === 1 ? "" : "s"} would lose their last running replica: ${lastReplicaControllers.join(", ")}`,
    );
    verdict = "unsafe";
  }

  return { verdict, reasons };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function errorResult(
  args: { action: string; node?: string; kind?: string; name?: string; namespace?: string },
  reason: string,
): BlastRadiusResult {
  return {
    meta: {
      action: args.action,
      target: args.node
        ? `Node/${args.node}`
        : `${args.kind ?? "?"}/${args.namespace ?? "default"}/${args.name ?? "?"}`,
      generatedAt: new Date().toISOString(),
      durationMs: 0,
    },
    verdict: "unsafe",
    reasons: [reason],
    details: {},
  };
}

function emptyMeta(action: string, target: string): BlastRadiusResult["meta"] {
  return {
    action,
    target,
    generatedAt: new Date().toISOString(),
    durationMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Async analyzers (collect data then dispatch to pure helpers)
// ---------------------------------------------------------------------------

interface PodSummary {
  name: string;
  namespace: string;
  controller: string | null;
  isStateful: boolean;
}

async function analyzeDrain(
  k8sClient: K8sClient,
  node: string,
): Promise<BlastRadiusResult> {
  const core = k8sClient.getCoreV1Api();

  const podList = await core.listPodForAllNamespaces({
    fieldSelector: `spec.nodeName=${node}`,
  });
  const pods: PodSummary[] = podList.items.map((p) => {
    const owner = topController(p.metadata?.ownerReferences);
    return {
      name: p.metadata?.name ?? "?",
      namespace: p.metadata?.namespace ?? "?",
      controller: owner ? `${owner.kind}/${owner.name}` : null,
      isStateful: owner?.kind === "StatefulSet",
    };
  });

  // Count pods per controller on this node, then for each controller
  // compare against its cluster-wide ready replica count.
  const controllerCounts: Record<string, number> = {};
  for (const p of pods) {
    if (p.controller) {
      controllerCounts[p.controller] = (controllerCounts[p.controller] ?? 0) + 1;
    }
  }

  const apps = k8sClient.getAppsV1Api();
  const lastReplicaControllers: string[] = [];
  for (const ctrl of Object.keys(controllerCounts)) {
    const [kind, ctrlName] = ctrl.split("/");
    if (!ctrlName) continue;
    const ns = pods.find((p) => p.controller === ctrl)?.namespace ?? "default";
    try {
      let ready = 0;
      if (kind === "ReplicaSet") {
        const rs = await apps.readNamespacedReplicaSet({ name: ctrlName, namespace: ns });
        ready = rs.status?.readyReplicas ?? 0;
      } else if (kind === "StatefulSet") {
        const sts = await apps.readNamespacedStatefulSet({ name: ctrlName, namespace: ns });
        ready = sts.status?.readyReplicas ?? 0;
      } else if (kind === "Deployment") {
        const d = await apps.readNamespacedDeployment({ name: ctrlName, namespace: ns });
        ready = d.status?.readyReplicas ?? 0;
      } else {
        // Unknown controller — be conservative
        lastReplicaControllers.push(ctrl);
        continue;
      }
      if (ready > 0 && ready - controllerCounts[ctrl] <= 0) {
        lastReplicaControllers.push(ctrl);
      }
    } catch {
      // Couldn't read controller — flag conservatively
      lastReplicaControllers.push(ctrl);
    }
  }

  const statefulPods = pods.filter((p) => p.isStateful).map((p) => `${p.namespace}/${p.name}`);
  const orphanPods = pods.filter((p) => !p.controller).map((p) => `${p.namespace}/${p.name}`);

  const { verdict, reasons } = analyzeDrainPods(
    pods.length,
    lastReplicaControllers,
    statefulPods,
    orphanPods,
  );

  return {
    meta: emptyMeta("drain", `Node/${node}`),
    verdict,
    reasons,
    details: {
      podsOnNode: pods.length,
      podsByController: controllerCounts,
      statefulPods,
      orphanPods,
      lastReplicaWorkloads: lastReplicaControllers,
    },
  };
}

async function analyzeCordon(
  k8sClient: K8sClient,
  node: string,
): Promise<BlastRadiusResult> {
  const core = k8sClient.getCoreV1Api();
  const [nodeList, podList] = await Promise.all([
    core.listNode(),
    core.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${node}` }),
  ]);
  const schedulable = nodeList.items.filter((n) => !n.spec?.unschedulable).length;

  const { verdict, reasons } = analyzeCordonCapacity(schedulable, podList.items.length);

  return {
    meta: emptyMeta("cordon", `Node/${node}`),
    verdict,
    reasons,
    details: {
      existingPods: podList.items.length,
      schedulableNodesBeforeCordon: schedulable,
      remainingSchedulableNodes: schedulable - 1,
    },
  };
}

async function analyzeDelete(
  k8sClient: K8sClient,
  kind: string,
  name: string,
  namespace: string,
): Promise<BlastRadiusResult> {
  const target = `${kind}/${namespace}/${name}`;
  const core = k8sClient.getCoreV1Api();
  const apps = k8sClient.getAppsV1Api();
  const reasons: string[] = [];
  let verdict: Verdict = "safe";

  if (kind === "Deployment") {
    const d = await apps.readNamespacedDeployment({ name, namespace });
    const replicas = d.spec?.replicas ?? 0;
    const labels = d.spec?.selector?.matchLabels ?? {};

    const services = (await core.listNamespacedService({ namespace })).items.filter(
      (s) => selectorMatches(labels, s.spec?.selector),
    );
    const pdbs = await listPdbs(k8sClient, namespace);
    const coveringPdbs = pdbs.filter((p) => selectorMatches(labels, p.selector));

    if (replicas === 1) {
      reasons.push("Deployment has only 1 replica — deletion = full outage of that workload");
      verdict = "unsafe";
    } else if (replicas > 1) {
      reasons.push(`${replicas} replicas will be terminated`);
      verdict = escalateVerdict(verdict, "risky");
    }
    if (services.length > 0) {
      reasons.push(
        `${services.length} Service${services.length === 1 ? "" : "s"} point at this Deployment: ${services
          .map((s) => s.metadata?.name)
          .join(", ")} — they will have no endpoints`,
      );
      verdict = "unsafe";
    }
    if (coveringPdbs.length > 0) {
      reasons.push(
        `${coveringPdbs.length} PDB${coveringPdbs.length === 1 ? "" : "s"} cover this Deployment — deletion bypasses them`,
      );
    }

    return {
      meta: emptyMeta("delete", target),
      verdict,
      reasons,
      details: {
        currentReplicas: replicas,
        affectedServices: services.map((s) => s.metadata?.name).filter(Boolean),
        coveringPdbs: coveringPdbs.map((p) => p.name),
      },
    };
  }

  if (kind === "StatefulSet") {
    const s = await apps.readNamespacedStatefulSet({ name, namespace });
    const replicas = s.spec?.replicas ?? 0;
    reasons.push(
      `StatefulSet has ${replicas} replica${replicas === 1 ? "" : "s"}; deletion ORPHANS PVCs unless cascading=foreground`,
    );
    verdict = "unsafe";
    return {
      meta: emptyMeta("delete", target),
      verdict,
      reasons,
      details: { currentReplicas: replicas },
    };
  }

  if (kind === "DaemonSet") {
    const ds = await apps.readNamespacedDaemonSet({ name, namespace });
    const ready = ds.status?.numberReady ?? 0;
    reasons.push(`DaemonSet has ${ready} ready pod(s); deletion removes the workload from every node`);
    verdict = "risky";
    return {
      meta: emptyMeta("delete", target),
      verdict,
      reasons,
      details: { readyPods: ready },
    };
  }

  if (kind === "Service") {
    const svc = await core.readNamespacedService({ name, namespace });
    const isLB = svc.spec?.type === "LoadBalancer";
    if (isLB) {
      reasons.push("LoadBalancer service — deletion releases external IP and breaks public access");
      verdict = "unsafe";
    } else {
      reasons.push("ClusterIP service — internal callers will lose connectivity");
      verdict = "risky";
    }
    return {
      meta: emptyMeta("delete", target),
      verdict,
      reasons,
      details: { type: svc.spec?.type, externalIPs: svc.spec?.externalIPs ?? [] },
    };
  }

  // Fallthrough — should not happen given enum validation
  return {
    meta: emptyMeta("delete", target),
    verdict: "risky",
    reasons: [`Delete of ${kind} not deeply analyzed; proceed with caution`],
    details: {},
  };
}

async function analyzeScale(
  k8sClient: K8sClient,
  kind: string,
  name: string,
  namespace: string,
  target: number,
): Promise<BlastRadiusResult> {
  const apps = k8sClient.getAppsV1Api();
  let current: number;
  let labels: Record<string, string> | undefined;

  if (kind === "Deployment") {
    const d = await apps.readNamespacedDeployment({ name, namespace });
    current = d.spec?.replicas ?? 0;
    labels = d.spec?.selector?.matchLabels;
  } else if (kind === "StatefulSet") {
    const s = await apps.readNamespacedStatefulSet({ name, namespace });
    current = s.spec?.replicas ?? 0;
    labels = s.spec?.selector?.matchLabels;
  } else {
    return {
      meta: emptyMeta("scale", `${kind}/${namespace}/${name}`),
      verdict: "unsafe",
      reasons: [`Scale not supported for kind '${kind}' (only Deployment and StatefulSet)`],
      details: {},
    };
  }

  const pdbs = await listPdbs(k8sClient, namespace);
  const { verdict, reasons } = analyzeScaleParams(current, target, labels, pdbs);

  return {
    meta: emptyMeta("scale", `${kind}/${namespace}/${name}`),
    verdict,
    reasons,
    details: {
      currentReplicas: current,
      targetReplicas: target,
      coveringPdbs: pdbs
        .filter((p) => selectorMatches(labels, p.selector))
        .map((p) => p.name),
    },
  };
}

/**
 * List PodDisruptionBudgets in a namespace, returning a normalized view.
 * Uses kc.makeApiClient since K8sClient may not expose getPolicyV1Api yet.
 */
async function listPdbs(k8sClient: K8sClient, namespace: string): Promise<PdbView[]> {
  try {
    const kc = (k8sClient as any).kc as k8s.KubeConfig | undefined;
    if (!kc) return [];
    const policy = kc.makeApiClient(k8s.PolicyV1Api);
    const list = await policy.listNamespacedPodDisruptionBudget({ namespace });
    return list.items.map((p) => ({
      name: p.metadata?.name ?? "?",
      minAvailable:
        typeof p.spec?.minAvailable === "number" || typeof p.spec?.minAvailable === "string"
          ? p.spec?.minAvailable
          : undefined,
      selector: p.spec?.selector?.matchLabels,
    }));
  } catch {
    return [];
  }
}
