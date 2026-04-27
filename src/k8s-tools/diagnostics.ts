import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";

function getAge(timestamp: Date | string | undefined): string {
  if (!timestamp) return "unknown";
  const now = Date.now();
  const created = new Date(timestamp).getTime();
  const diffMs = now - created;
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  if (days > 365) return `${Math.floor(days / 365)}y${days % 365}d`;
  if (days > 0) return `${days}d${hours}h`;
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

function getAgeDays(timestamp: Date | string | undefined): number {
  if (!timestamp) return 0;
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function registerDiagnosticsTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_namespace_summary",
        description: "Get a comprehensive summary of all resources in a namespace - pods, deployments, services, configmaps, secrets, jobs, and resource usage at a glance",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to summarize",
              default: "default",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        const ns = namespace || "default";
        const coreApi = k8sClient.getCoreV1Api();

        try {
          const [pods, services, deployments, jobs, cronJobs, configMaps, secrets, events, ingresses] = await Promise.all([
            k8sClient.listPods(ns),
            k8sClient.listServices(ns),
            k8sClient.listDeployments(ns),
            k8sClient.listJobs(ns),
            k8sClient.listCronJobs(ns),
            k8sClient.listConfigMaps(ns),
            k8sClient.listSecrets(ns),
            k8sClient.listEvents(ns),
            k8sClient.listIngresses(ns),
          ]);

          // Pod status breakdown
          const podStatuses: Record<string, number> = {};
          let totalRestarts = 0;
          for (const pod of pods) {
            const phase = pod.status?.phase || "Unknown";
            podStatuses[phase] = (podStatuses[phase] || 0) + 1;
            for (const cs of pod.status?.containerStatuses || []) {
              totalRestarts += cs.restartCount || 0;
            }
          }

          // Deployment health
          const deploymentSummary = deployments.map((d: k8s.V1Deployment) => ({
            name: d.metadata?.name,
            replicas: `${d.status?.readyReplicas || 0}/${d.spec?.replicas || 0}`,
            upToDate: d.status?.updatedReplicas || 0,
            available: d.status?.availableReplicas || 0,
            age: getAge(d.metadata?.creationTimestamp),
          }));

          // Recent warning events
          const recentWarnings = events
            .filter((e: k8s.CoreV1Event) => e.type === "Warning")
            .sort((a: k8s.CoreV1Event, b: k8s.CoreV1Event) =>
              new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime()
            )
            .slice(0, 10)
            .map((e: k8s.CoreV1Event) => ({
              reason: e.reason,
              message: e.message?.substring(0, 120),
              object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
              count: e.count,
              age: getAge(e.lastTimestamp),
            }));

          return {
            namespace: ns,
            resourceCounts: {
              pods: pods.length,
              deployments: deployments.length,
              services: services.length,
              jobs: jobs.length,
              cronJobs: cronJobs.length,
              configMaps: configMaps.length,
              secrets: secrets.length,
              ingresses: ingresses.length,
            },
            podStatus: podStatuses,
            totalContainerRestarts: totalRestarts,
            deployments: deploymentSummary,
            services: services.map((s: k8s.V1Service) => ({
              name: s.metadata?.name,
              type: s.spec?.type,
              clusterIP: s.spec?.clusterIP,
              ports: s.spec?.ports?.map(p => `${p.port}/${p.protocol}`).join(", "),
            })),
            recentWarnings,
            warningCount: events.filter((e: k8s.CoreV1Event) => e.type === "Warning").length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_namespace_summary", namespace: ns };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_resource_age_report",
        description: "Find old, stale, or long-running resources. Helps identify resources that may need cleanup or attention.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to check (default: all namespaces)",
            },
            olderThanDays: {
              type: "number",
              description: "Show resources older than N days",
              default: 30,
            },
            resourceTypes: {
              type: "array",
              items: { type: "string" },
              description: "Resource types to check (default: pods, jobs, deployments)",
            },
          },
        },
      },
      handler: async ({ namespace, olderThanDays, resourceTypes }: {
        namespace?: string;
        olderThanDays?: number;
        resourceTypes?: string[];
      }) => {
        const threshold = olderThanDays || 30;
        const types = resourceTypes || ["pods", "jobs", "deployments", "configmaps"];

        try {
          const results: Record<string, any[]> = {};

          if (types.includes("pods")) {
            const pods = await k8sClient.listPods(namespace);
            results.stalePods = pods
              .filter((p: k8s.V1Pod) => getAgeDays(p.metadata?.creationTimestamp) > threshold)
              .map((p: k8s.V1Pod) => ({
                name: p.metadata?.name,
                namespace: p.metadata?.namespace,
                status: p.status?.phase,
                age: getAge(p.metadata?.creationTimestamp),
                ageDays: getAgeDays(p.metadata?.creationTimestamp),
                node: p.spec?.nodeName,
              }))
              .sort((a: any, b: any) => b.ageDays - a.ageDays);
          }

          if (types.includes("jobs")) {
            const jobs = await k8sClient.listJobs(namespace);
            results.completedJobs = jobs
              .filter((j: k8s.V1Job) => {
                const isComplete = j.status?.conditions?.some(c => c.type === "Complete" && c.status === "True");
                const isFailed = j.status?.conditions?.some(c => c.type === "Failed" && c.status === "True");
                return (isComplete || isFailed) && getAgeDays(j.metadata?.creationTimestamp) > threshold;
              })
              .map((j: k8s.V1Job) => ({
                name: j.metadata?.name,
                namespace: j.metadata?.namespace,
                status: j.status?.conditions?.[0]?.type || "Unknown",
                age: getAge(j.metadata?.creationTimestamp),
                ageDays: getAgeDays(j.metadata?.creationTimestamp),
                completionTime: j.status?.completionTime,
              }))
              .sort((a: any, b: any) => b.ageDays - a.ageDays);
          }

          if (types.includes("deployments")) {
            const deployments = await k8sClient.listDeployments(namespace);
            results.oldDeployments = deployments
              .filter((d: k8s.V1Deployment) => getAgeDays(d.metadata?.creationTimestamp) > threshold)
              .map((d: k8s.V1Deployment) => ({
                name: d.metadata?.name,
                namespace: d.metadata?.namespace,
                replicas: `${d.status?.readyReplicas || 0}/${d.spec?.replicas || 0}`,
                age: getAge(d.metadata?.creationTimestamp),
                ageDays: getAgeDays(d.metadata?.creationTimestamp),
                hasZeroReplicas: (d.spec?.replicas || 0) === 0,
              }))
              .sort((a: any, b: any) => b.ageDays - a.ageDays);
          }

          if (types.includes("configmaps")) {
            const configMaps = await k8sClient.listConfigMaps(namespace);
            results.oldConfigMaps = configMaps
              .filter((cm: k8s.V1ConfigMap) => getAgeDays(cm.metadata?.creationTimestamp) > threshold)
              .filter((cm: k8s.V1ConfigMap) => !cm.metadata?.name?.startsWith("kube-"))
              .map((cm: k8s.V1ConfigMap) => ({
                name: cm.metadata?.name,
                namespace: cm.metadata?.namespace,
                age: getAge(cm.metadata?.creationTimestamp),
                ageDays: getAgeDays(cm.metadata?.creationTimestamp),
                dataKeys: Object.keys(cm.data || {}).length,
              }))
              .sort((a: any, b: any) => b.ageDays - a.ageDays)
              .slice(0, 50);
          }

          const totalStale = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

          return {
            threshold: `${threshold} days`,
            namespace: namespace || "all",
            totalStaleResources: totalStale,
            ...results,
            recommendations: totalStale > 0
              ? [
                "Consider cleaning up completed/failed jobs",
                "Review deployments with 0 replicas for removal",
                "Check if stale configmaps are still referenced",
                "Long-running pods may indicate missing restart policies",
              ]
              : ["No stale resources found - cluster looks clean!"],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_resource_age_report", namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_pod_log_search",
        description: "Search for patterns in pod logs across multiple pods. Useful for finding errors, exceptions, or specific messages.",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Text pattern to search for in logs (case-insensitive)",
            },
            namespace: {
              type: "string",
              description: "Namespace to search in",
              default: "default",
            },
            labelSelector: {
              type: "string",
              description: "Label selector to filter pods (e.g., app=nginx)",
            },
            tailLines: {
              type: "number",
              description: "Number of recent log lines to search per pod",
              default: 500,
            },
            maxPods: {
              type: "number",
              description: "Maximum number of pods to search",
              default: 20,
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in matched log lines (passwords, tokens, emails, IPs)",
              default: false,
            },
          },
          required: ["pattern"],
        },
      },
      handler: async ({ pattern, namespace, labelSelector, tailLines, maxPods, scrub }: {
        pattern: string;
        namespace?: string;
        labelSelector?: string;
        tailLines?: number;
        maxPods?: number;
        scrub?: boolean;
      }) => {
        const ns = namespace || "default";
        const lines = tailLines || 500;
        const limit = maxPods || 20;

        try {
          let pods = await k8sClient.listPods(ns);

          // Filter by label selector if provided
          if (labelSelector) {
            const [key, value] = labelSelector.split("=");
            pods = pods.filter((p: k8s.V1Pod) => p.metadata?.labels?.[key] === value);
          }

          // Limit pods to search
          pods = pods.slice(0, limit);

          const matches: any[] = [];
          const escapedPattern = escapeRegExp(pattern);
          const regex = new RegExp(escapedPattern, "gi");

          for (const pod of pods) {
            const podName = pod.metadata?.name || "";
            try {
              const logs = await k8sClient.getPodLogs(podName, ns, undefined, lines);
              const logLines = logs.split("\n");
              const matchingLines = logLines
                .map((line, idx) => ({ line: line.trim(), lineNumber: idx + 1 }))
                .filter(({ line }) => regex.test(line));

              if (matchingLines.length > 0) {
                matches.push({
                  pod: podName,
                  matchCount: matchingLines.length,
                  matches: matchingLines.slice(0, 10).map(m => ({
                    line: m.lineNumber,
                    text: scrub ? scrubSensitiveData(m.line.substring(0, 200)) : m.line.substring(0, 200),
                  })),
                });
              }
              // Reset regex lastIndex
              regex.lastIndex = 0;
            } catch {
              // Skip pods that can't provide logs (not running, etc.)
            }
          }

          return {
            pattern,
            namespace: ns,
            podsSearched: pods.length,
            podsWithMatches: matches.length,
            totalMatches: matches.reduce((sum, m) => sum + m.matchCount, 0),
            scrub: scrub || false,
            results: matches,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_pod_log_search", namespace: ns };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_resource_comparison",
        description: "Compare resource counts and status across two namespaces. Useful for verifying staging/production parity.",
        inputSchema: {
          type: "object",
          properties: {
            namespace1: {
              type: "string",
              description: "First namespace to compare",
            },
            namespace2: {
              type: "string",
              description: "Second namespace to compare",
            },
          },
          required: ["namespace1", "namespace2"],
        },
      },
      handler: async ({ namespace1, namespace2 }: { namespace1: string; namespace2: string }) => {
        try {
          const [
            pods1, pods2,
            deploys1, deploys2,
            svcs1, svcs2,
            cms1, cms2,
            secrets1, secrets2,
          ] = await Promise.all([
            k8sClient.listPods(namespace1),
            k8sClient.listPods(namespace2),
            k8sClient.listDeployments(namespace1),
            k8sClient.listDeployments(namespace2),
            k8sClient.listServices(namespace1),
            k8sClient.listServices(namespace2),
            k8sClient.listConfigMaps(namespace1),
            k8sClient.listConfigMaps(namespace2),
            k8sClient.listSecrets(namespace1),
            k8sClient.listSecrets(namespace2),
          ]);

          const compare = (name: string, list1: any[], list2: any[]) => ({
            resource: name,
            [namespace1]: list1.length,
            [namespace2]: list2.length,
            difference: list1.length - list2.length,
          });

          // Find deployments that exist in one but not the other
          const deploy1Names = new Set(deploys1.map((d: any) => d.metadata?.name));
          const deploy2Names = new Set(deploys2.map((d: any) => d.metadata?.name));
          const onlyIn1 = [...deploy1Names].filter(n => !deploy2Names.has(n));
          const onlyIn2 = [...deploy2Names].filter(n => !deploy1Names.has(n));

          return {
            comparison: [
              compare("Pods", pods1, pods2),
              compare("Deployments", deploys1, deploys2),
              compare("Services", svcs1, svcs2),
              compare("ConfigMaps", cms1, cms2),
              compare("Secrets", secrets1, secrets2),
            ],
            deploymentDifferences: {
              onlyInNamespace1: onlyIn1,
              onlyInNamespace2: onlyIn2,
              inBoth: [...deploy1Names].filter(n => deploy2Names.has(n)),
            },
            summary: onlyIn1.length + onlyIn2.length === 0
              ? "Namespaces have matching deployment sets"
              : `Found ${onlyIn1.length + onlyIn2.length} deployment differences`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_resource_comparison" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_container_image_report",
        description: "Report on all container images used in the cluster. Helps audit image versions, find outdated images, and identify tag usage.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to scan (default: all namespaces)",
            },
            filter: {
              type: "string",
              description: "Filter images by name pattern (e.g., 'nginx', 'myregistry.io')",
            },
          },
        },
      },
      handler: async ({ namespace, filter }: { namespace?: string; filter?: string }) => {
        try {
          const pods = await k8sClient.listPods(namespace);
          const imageMap = new Map<string, { count: number; pods: string[]; namespaces: Set<string> }>();

          for (const pod of pods) {
            const containers = [
              ...(pod.spec?.containers || []),
              ...(pod.spec?.initContainers || []),
            ];
            for (const c of containers) {
              const image = c.image || "unknown";
              if (filter && !image.toLowerCase().includes(filter.toLowerCase())) continue;

              if (!imageMap.has(image)) {
                imageMap.set(image, { count: 0, pods: [], namespaces: new Set() });
              }
              const entry = imageMap.get(image)!;
              entry.count++;
              if (entry.pods.length < 5) entry.pods.push(pod.metadata?.name || "");
              entry.namespaces.add(pod.metadata?.namespace || "");
            }
          }

          const images = Array.from(imageMap.entries())
            .map(([image, data]) => {
              const [repo, tag] = image.includes(":") ? image.split(":") : [image, "latest"];
              return {
                image,
                repository: repo,
                tag,
                usesLatest: tag === "latest" || !image.includes(":"),
                count: data.count,
                namespaces: Array.from(data.namespaces),
                samplePods: data.pods,
              };
            })
            .sort((a, b) => b.count - a.count);

          const usingLatest = images.filter(i => i.usesLatest);

          return {
            namespace: namespace || "all",
            totalUniqueImages: images.length,
            totalContainers: images.reduce((sum, i) => sum + i.count, 0),
            imagesUsingLatestTag: usingLatest.length,
            images: images.slice(0, 100),
            warnings: usingLatest.length > 0
              ? [`${usingLatest.length} images use :latest tag - pin specific versions for reproducibility`]
              : [],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_container_image_report", namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_restart_report",
        description: "Report on container restarts across the cluster. Identifies containers that are frequently restarting.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to check (default: all namespaces)",
            },
            minRestarts: {
              type: "number",
              description: "Minimum restart count to include",
              default: 1,
            },
          },
        },
      },
      handler: async ({ namespace, minRestarts }: { namespace?: string; minRestarts?: number }) => {
        const threshold = minRestarts ?? 1;
        try {
          const pods = await k8sClient.listPods(namespace);
          const restartingContainers: any[] = [];

          for (const pod of pods) {
            for (const cs of pod.status?.containerStatuses || []) {
              if ((cs.restartCount || 0) >= threshold) {
                restartingContainers.push({
                  pod: pod.metadata?.name,
                  namespace: pod.metadata?.namespace,
                  container: cs.name,
                  restartCount: cs.restartCount,
                  ready: cs.ready,
                  state: cs.state?.waiting?.reason || cs.state?.running ? "Running" : cs.state?.terminated?.reason || "Unknown",
                  lastTermination: cs.lastState?.terminated
                    ? {
                      reason: cs.lastState.terminated.reason,
                      exitCode: cs.lastState.terminated.exitCode,
                      finishedAt: cs.lastState.terminated.finishedAt,
                    }
                    : null,
                });
              }
            }
          }

          restartingContainers.sort((a, b) => b.restartCount - a.restartCount);

          return {
            namespace: namespace || "all",
            minRestartThreshold: threshold,
            containersWithRestarts: restartingContainers.length,
            totalRestarts: restartingContainers.reduce((sum, c) => sum + c.restartCount, 0),
            containers: restartingContainers.slice(0, 50),
            topReasons: (() => {
              const reasons: Record<string, number> = {};
              for (const c of restartingContainers) {
                const reason = c.lastTermination?.reason || c.state || "Unknown";
                reasons[reason] = (reasons[reason] || 0) + 1;
              }
              return Object.entries(reasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => ({ reason, count }));
            })(),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_restart_report", namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
