import * as k8s from "@kubernetes/client-node";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { execFileSync, spawn } from "child_process";

import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";

export function registerWebSocketTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_exec_pod",
        description: "Execute command in a pod, or first pod of a deployment/service. Supports format like 'deploy/my-deployment' or 'svc/my-service'. Can execute directly (returns output) or return WebSocket URL for interactive sessions.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Pod name, or deployment (deploy/name), or service (svc/name). Use format like 'deploy/my-deployment' or 'svc/my-service'",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (for multi-container pods)",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description: "Command to execute",
              default: ["/bin/sh"],
            },
            tty: {
              type: "boolean",
              description: "Allocate TTY (like kubectl exec -t)",
              default: false,
            },
            stdin: {
              type: "boolean",
              description: "Pass stdin to container (like kubectl exec -i)",
              default: false,
            },
            mode: {
              type: "string",
              description: "Execution mode: 'direct' executes command and returns output, 'websocket' returns WebSocket URL for interactive session",
              enum: ["direct", "websocket"],
              default: "direct",
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in command output (passwords, tokens, emails, IPs)",
              default: false,
            },
          },
          required: ["resource", "namespace"],
        },
      },
      handler: async ({ 
        resource, 
        namespace, 
        container, 
        command,
        tty,
        stdin,
        mode,
        scrub
      }: { 
        resource: string; 
        namespace: string; 
        container?: string; 
        command?: string[];
        tty?: boolean;
        stdin?: boolean;
        scrub?: boolean;
        mode?: string;
      }) => {
        const ns = namespace || "default";
        const execMode = mode || "direct";
        const coreApi = k8sClient.getCoreV1Api();
        
        try {
          // Parse resource type
          let resourceType = "pod";
          let resourceName = resource;
          
          if (resource.includes("/")) {
            const [type, ...rest] = resource.split("/");
            resourceName = rest.join("/");
            
            if (type === "deploy" || type === "deployment" || type === "deployments") {
              resourceType = "deployment";
            } else if (type === "svc" || type === "service" || type === "services") {
              resourceType = "service";
            } else if (type === "pod" || type === "pods") {
              resourceType = "pod";
            }
          }
          
          let targetPod = resourceName;
          
          // Build kubectl command based on resource type
          const flags = `${tty ? ' -t' : ''}${stdin ? ' -i' : ''}${container ? ` -c ${container}` : ''}`;
          let kubectlCommand: string;
          
          if (resourceType === "deployment") {
            kubectlCommand = `kubectl exec deploy/${resourceName} -n ${ns}${flags} -- ${(command || ["/bin/sh"]).join(" ")}`;
          } else if (resourceType === "service") {
            kubectlCommand = `kubectl exec svc/${resourceName} -n ${ns}${flags} -- ${(command || ["/bin/sh"]).join(" ")}`;
          } else {
            kubectlCommand = `kubectl exec ${resourceName} -n ${ns}${flags} -- ${(command || ["/bin/sh"]).join(" ")}`;
          }

          // Direct execution mode
          if (execMode === "direct") {
            try {
              // Build kubectl args array for safe execution
              const kubectlArgs = ["exec"];
              
              if (resourceType === "deployment") {
                kubectlArgs.push("deploy/" + resourceName);
              } else if (resourceType === "service") {
                kubectlArgs.push("svc/" + resourceName);
              } else {
                kubectlArgs.push(resourceName);
              }
              
              kubectlArgs.push("-n", ns);
              
              if (tty) kubectlArgs.push("-t");
              if (stdin) kubectlArgs.push("-i");
              if (container) {
                kubectlArgs.push("-c", container);
              }
              
              kubectlArgs.push("--");
              kubectlArgs.push(...(command || ["/bin/sh"]));
              
              // Execute kubectl command directly
              let output = execFileSync("kubectl", kubectlArgs, {
                encoding: "utf8",
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
              });
              
              if (scrub) {
                output = scrubSensitiveData(output);
              }
              
              return {
                success: true,
                mode: "direct",
                output,
                scrubbed: scrub || false,
                resourceType,
                resourceName,
                targetPod,
                namespace: ns,
                container,
                command: command || ["/bin/sh"],
                tty: tty || false,
                stdin: stdin || false,
              };
            } catch (execError: any) {
              // If direct execution fails, provide fallback
              return {
                success: false,
                mode: "direct",
                error: execError.message || "Command execution failed",
                kubectlCommand,
                suggestions: [
                  "Ensure kubectl is installed and in PATH",
                  "Check kubeconfig is properly configured",
                  "Verify the pod/deployment/service exists",
                  "Try using mode='websocket' for interactive sessions",
                ],
              };
            }
          }
          
          // WebSocket mode (original behavior)
          const execUrl = await coreApi.connectGetNamespacedPodExec({
            name: targetPod,
            namespace: ns,
            command: (command || ["/bin/sh"]).join(" "),
            container,
            stdin: stdin || false,
            tty: tty || false,
            stdout: true,
            stderr: true
          });

          return {
            success: true,
            mode: "websocket",
            execInfo: {
              resourceType,
              resourceName,
              targetPod,
              namespace: ns,
              container,
              command: command || ["/bin/sh"],
              tty: tty || false,
              stdin: stdin || false,
              websocketUrl: execUrl,
              note: resourceType !== "pod" 
                ? `WebSocket URL targets pod '${targetPod}' directly. For deployment/service, kubectl command is recommended.`
                : "WebSocket connection required for interactive exec",
            },
            kubectlCommand,
            instructions: [
              "Use the provided kubectl command for deployment/service execution",
              "kubectl will automatically select the first available pod",
              "For direct pod exec, use the websocketUrl",
              tty ? "TTY enabled - use for interactive terminal sessions" : undefined,
              stdin ? "Stdin enabled - can send input to the container" : undefined,
            ].filter(Boolean),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_exec_pod", resource: resource, namespace: ns };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_port_forward",
        description: "Set up port forwarding to a pod, deployment, or service. Supports format like 'deploy/my-deployment' or 'svc/my-service'. Use mode='direct' for immediate port forwarding.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Pod name, or deployment (deploy/name), or service (svc/name). Use format like 'deploy/my-deployment' or 'svc/my-service'",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            ports: {
              type: "array",
              items: { type: "string" },
              description: "Port mappings (e.g., ['8080:80', '8443:443']). For services, can use port name like '5000:my-service-port'",
            },
            mode: {
              type: "string",
              description: "Execution mode: 'direct' for immediate port forwarding, 'command' to return kubectl command string",
              enum: ["direct", "command"],
              default: "direct",
            },
          },
          required: ["resource", "ports"],
        },
      },
      handler: async ({ 
        resource, 
        namespace, 
        ports,
        mode
      }: { 
        resource: string; 
        namespace: string; 
        ports: string[];
        mode?: string;
      }) => {
        const ns = namespace || "default";
        const executionMode = mode || "direct";
        
        // Parse resource type outside try block for error context
        let resourceType = "pod";
        let resourceName = resource;
        
        if (resource.includes("/")) {
          const [type, ...rest] = resource.split("/");
          resourceName = rest.join("/");
          
          if (type === "deploy" || type === "deployment" || type === "deployments") {
            resourceType = "deployment";
          } else if (type === "svc" || type === "service" || type === "services") {
            resourceType = "service";
          } else if (type === "pod" || type === "pods") {
            resourceType = "pod";
          }
        }
        
        try {
          // Parse port mappings
          const portMappings = ports.map(mapping => {
            const parts = mapping.split(':');
            return {
              local: parseInt(parts[0]),
              remote: parts[1] || parts[0], // Can be number or name for services
              remoteIsName: isNaN(parseInt(parts[1])),
            };
          });

          // Build kubectl command
          let kubectlCommand: string;
          
          if (resourceType === "deployment") {
            kubectlCommand = `kubectl port-forward deploy/${resourceName} ${ports.join(" ")} -n ${ns}`;
          } else if (resourceType === "service") {
            kubectlCommand = `kubectl port-forward svc/${resourceName} ${ports.join(" ")} -n ${ns}`;
          } else {
            kubectlCommand = `kubectl port-forward ${resourceName} ${ports.join(" ")} -n ${ns}`;
          }

          // Direct execution mode
          if (executionMode === "direct") {
            try {
              // Spawn kubectl port-forward process
              const args = ["port-forward", resource, ...ports, "-n", ns];
              const process = spawn("kubectl", args);
              
              return {
                success: true,
                mode: "direct",
                forwardInfo: {
                  resourceType,
                  resourceName,
                  namespace: ns,
                  portMappings,
                  pid: process.pid,
                  status: "forwarding",
                },
                kubectlCommand,
                instructions: [
                  "Port forwarding started in background",
                  `Process ID: ${process.pid}`,
                  "Access forwarded ports via localhost",
                  "To stop forwarding, kill the process",
                ],
              };
            } catch (spawnError: any) {
              return {
                success: false,
                error: "Failed to start port forwarding",
                message: spawnError.message,
                fallback: "Use command mode instead",
                kubectlCommand,
              };
            }
          }

          // Command mode (default)
          return {
            mode: "command",
            forwardInfo: {
              resourceType,
              resourceName,
              namespace: ns,
              portMappings,
              note: "Execute the kubectl command to start port forwarding",
            },
            kubectlCommand,
            instructions: [
              "Execute the provided kubectl command to start port forwarding",
              "For deployments/services, kubectl will automatically select a pod",
              "Access via localhost:localPort",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_port_forward", resource: resourceName, namespace: ns };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_stream_logs",
        description: "Stream pod logs in real-time (returns stream info)",
        inputSchema: {
          type: "object",
          properties: {
            pod: {
              type: "string",
              description: "Pod name",
            },
            namespace: {
              type: "string",
              description: "Pod namespace",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (for multi-container pods)",
            },
            follow: {
              type: "boolean",
              description: "Follow log stream",
              default: true,
            },
            tailLines: {
              type: "number",
              description: "Number of lines to show from the end",
              default: 100,
            },
          },
          required: ["pod", "namespace"],
        },
      },
      handler: async ({ 
        pod, 
        namespace, 
        container, 
        follow, 
        tailLines 
      }: { 
        pod: string; 
        namespace: string; 
        container?: string; 
        follow?: boolean; 
        tailLines?: number; 
      }) => {
        const coreApi = k8sClient.getCoreV1Api();
        
        try {
          // Create log stream request
          const logStream = new k8s.Log(k8sClient.kc);
          
          // This would normally establish WebSocket connection for streaming
          // For MCP, we return the stream info
          const streamUrl = await logStream.log(
            namespace,
            pod,
            container || "", // Ensure container is not undefined
            { write: () => {}, end: () => {} } as any // output stream
          );

          return {
            streamInfo: {
              pod,
              namespace,
              container,
              follow: follow || true,
              tailLines: tailLines || 100,
              websocketUrl: streamUrl,
              note: "WebSocket connection required for log streaming",
            },
            instructions: [
              "Use the websocketUrl to establish WebSocket connection",
              "Receive log lines through WebSocket messages",
              "Stream will continue until disconnected",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_stream_logs", resource: pod, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_attach_pod",
        description: "Attach to running pod (returns attach info)",
        inputSchema: {
          type: "object",
          properties: {
            pod: {
              type: "string",
              description: "Pod name",
            },
            namespace: {
              type: "string",
              description: "Pod namespace",
              default: "default",
            },
            container: {
              type: "string",
              description: "Container name (for multi-container pods)",
            },
            stdin: {
              type: "boolean",
              description: "Attach stdin",
              default: true,
            },
            stdout: {
              type: "boolean",
              description: "Attach stdout",
              default: true,
            },
            stderr: {
              type: "boolean",
              description: "Attach stderr",
              default: true,
            },
          },
          required: ["pod", "namespace"],
        },
      },
      handler: async ({ 
        pod, 
        namespace, 
        container, 
        stdin, 
        stdout, 
        stderr 
      }: { 
        pod: string; 
        namespace: string; 
        container?: string; 
        stdin?: boolean; 
        stdout?: boolean; 
        stderr?: boolean; 
      }) => {
        const coreApi = k8sClient.getCoreV1Api();
        
        try {
          // Create attach request
          const attach = new k8s.Attach(k8sClient.kc);
          
          // This would normally establish WebSocket connection
          // For MCP, we return the connection info
          const attachUrl = await coreApi.connectGetNamespacedPodAttach({
            name: pod,
            namespace,
            container,
            stderr: stderr || true,
            stdin: stdin || true,
            stdout: stdout || true,
            tty: false
          });

          return {
            attachInfo: {
              pod,
              namespace,
              container,
              stdin: stdin || true,
              stdout: stdout || true,
              stderr: stderr || true,
              websocketUrl: attachUrl,
              note: "WebSocket connection required for pod attachment",
            },
            instructions: [
              "Use the websocketUrl to establish WebSocket connection",
              "Send stdin data through WebSocket",
              "Receive stdout/stderr through WebSocket messages",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_attach_pod", resource: pod, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    // Watch resources in real-time
    {
      tool: {
        name: "k8s_watch",
        description: "Watch resources for changes in real-time (like kubectl get --watch). Returns WebSocket URL for streaming events.",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type to watch (pod, deployment, service, configmap, secret, etc.)",
            },
            namespace: {
              type: "string",
              description: "Namespace to watch (default: all namespaces for cluster-scoped, default for namespaced)",
            },
            name: {
              type: "string",
              description: "Specific resource name to watch (optional - watches all resources of type if not specified)",
            },
            labelSelector: {
              type: "string",
              description: "Label selector to filter watched resources (e.g., app=nginx)",
            },
            fieldSelector: {
              type: "string",
              description: "Field selector to filter watched resources (e.g., metadata.name=my-pod)",
            },
          },
          required: ["resource"],
        },
      },
      handler: async ({
        resource,
        namespace,
        name,
        labelSelector,
        fieldSelector,
      }: {
        resource: string;
        namespace?: string;
        name?: string;
        labelSelector?: string;
        fieldSelector?: string;
      }) => {
        try {
          const ns = namespace || "default";
          
          // Map resource types to their API paths
          const resourcePaths: Record<string, { path: string; namespaced: boolean; version: string }> = {
            pods: { path: "pods", namespaced: true, version: "v1" },
            pod: { path: "pods", namespaced: true, version: "v1" },
            services: { path: "services", namespaced: true, version: "v1" },
            service: { path: "services", namespaced: true, version: "v1" },
            configmaps: { path: "configmaps", namespaced: true, version: "v1" },
            configmap: { path: "configmaps", namespaced: true, version: "v1" },
            secrets: { path: "secrets", namespaced: true, version: "v1" },
            secret: { path: "secrets", namespaced: true, version: "v1" },
            deployments: { path: "deployments", namespaced: true, version: "apps/v1" },
            deployment: { path: "deployments", namespaced: true, version: "apps/v1" },
            replicasets: { path: "replicasets", namespaced: true, version: "apps/v1" },
            replicaset: { path: "replicasets", namespaced: true, version: "apps/v1" },
            statefulsets: { path: "statefulsets", namespaced: true, version: "apps/v1" },
            statefulset: { path: "statefulsets", namespaced: true, version: "apps/v1" },
            daemonsets: { path: "daemonsets", namespaced: true, version: "apps/v1" },
            daemonset: { path: "daemonsets", namespaced: true, version: "apps/v1" },
            jobs: { path: "jobs", namespaced: true, version: "batch/v1" },
            job: { path: "jobs", namespaced: true, version: "batch/v1" },
            cronjobs: { path: "cronjobs", namespaced: true, version: "batch/v1" },
            cronjob: { path: "cronjobs", namespaced: true, version: "batch/v1" },
            ingresses: { path: "ingresses", namespaced: true, version: "networking.k8s.io/v1" },
            ingress: { path: "ingresses", namespaced: true, version: "networking.k8s.io/v1" },
            networkpolicies: { path: "networkpolicies", namespaced: true, version: "networking.k8s.io/v1" },
            networkpolicy: { path: "networkpolicies", namespaced: true, version: "networking.k8s.io/v1" },
            persistentvolumeclaims: { path: "persistentvolumeclaims", namespaced: true, version: "v1" },
            pvc: { path: "persistentvolumeclaims", namespaced: true, version: "v1" },
            persistentvolumes: { path: "persistentvolumes", namespaced: false, version: "v1" },
            pv: { path: "persistentvolumes", namespaced: false, version: "v1" },
            nodes: { path: "nodes", namespaced: false, version: "v1" },
            node: { path: "nodes", namespaced: false, version: "v1" },
            namespaces: { path: "namespaces", namespaced: false, version: "v1" },
            namespace: { path: "namespaces", namespaced: false, version: "v1" },
            endpoints: { path: "endpoints", namespaced: true, version: "v1" },
            endpoint: { path: "endpoints", namespaced: true, version: "v1" },
            events: { path: "events", namespaced: true, version: "v1" },
            event: { path: "events", namespaced: true, version: "v1" },
            serviceaccounts: { path: "serviceaccounts", namespaced: true, version: "v1" },
            serviceaccount: { path: "serviceaccounts", namespaced: true, version: "v1" },
            roles: { path: "roles", namespaced: true, version: "rbac.authorization.k8s.io/v1" },
            role: { path: "roles", namespaced: true, version: "rbac.authorization.k8s.io/v1" },
            clusterroles: { path: "clusterroles", namespaced: false, version: "rbac.authorization.k8s.io/v1" },
            clusterrole: { path: "clusterroles", namespaced: false, version: "rbac.authorization.k8s.io/v1" },
            rolebindings: { path: "rolebindings", namespaced: true, version: "rbac.authorization.k8s.io/v1" },
            rolebinding: { path: "rolebindings", namespaced: true, version: "rbac.authorization.k8s.io/v1" },
            clusterrolebindings: { path: "clusterrolebindings", namespaced: false, version: "rbac.authorization.k8s.io/v1" },
            clusterrolebinding: { path: "clusterrolebindings", namespaced: false, version: "rbac.authorization.k8s.io/v1" },
            storageclasses: { path: "storageclasses", namespaced: false, version: "storage.k8s.io/v1" },
            storageclass: { path: "storageclasses", namespaced: false, version: "storage.k8s.io/v1" },
          };
          
          const resourceInfo = resourcePaths[resource.toLowerCase()];
          if (!resourceInfo) {
            return {
              success: false,
              error: `Unsupported resource type: ${resource}`,
              supportedResources: Object.keys(resourcePaths).sort(),
            };
          }
          
          // Build watch URL
          let watchPath: string;
          if (name) {
            // Watch specific resource
            if (resourceInfo.namespaced) {
              watchPath = `/api/${resourceInfo.version}/namespaces/${ns}/${resourceInfo.path}?watch=true&fieldSelector=metadata.name=${name}`;
            } else {
              watchPath = `/api/${resourceInfo.version}/${resourceInfo.path}?watch=true&fieldSelector=metadata.name=${name}`;
            }
          } else {
            // Watch all resources of type
            const selectors: string[] = [];
            if (labelSelector) selectors.push(`labelSelector=${encodeURIComponent(labelSelector)}`);
            if (fieldSelector) selectors.push(`fieldSelector=${encodeURIComponent(fieldSelector)}`);
            
            if (resourceInfo.namespaced) {
              watchPath = `/api/${resourceInfo.version}/namespaces/${ns}/${resourceInfo.path}?watch=true${selectors.length > 0 ? '&' + selectors.join('&') : ''}`;
            } else {
              watchPath = `/api/${resourceInfo.version}/${resourceInfo.path}?watch=true${selectors.length > 0 ? '&' + selectors.join('&') : ''}`;
            }
          }
          
          // Get the current cluster's server URL
          const cluster = k8sClient.kc.getCurrentCluster();
          if (!cluster) {
            return {
              success: false,
              error: "No cluster configured",
            };
          }
          
          const baseUrl = cluster.server.replace(/\/$/, '');
          const fullUrl = `${baseUrl}${watchPath}`;
          
          return {
            success: true,
            watchInfo: {
              resource,
              namespace: resourceInfo.namespaced ? ns : undefined,
              name,
              labelSelector,
              fieldSelector,
              apiVersion: resourceInfo.version,
              watchUrl: fullUrl,
              note: "WebSocket connection required for watch. Connect to watchUrl to receive resource change events.",
            },
            kubectlCommand: `kubectl get ${resource}${name ? `/${name}` : ''}${resourceInfo.namespaced ? ` -n ${ns}` : ''}${labelSelector ? ` -l ${labelSelector}` : ''} --watch`,
            instructions: [
              "Use the provided kubectl command for simple watching",
              "For programmatic access, use the watchUrl with a WebSocket client",
              "Events will be streamed as JSON objects with 'type' (ADDED, MODIFIED, DELETED) and 'object' fields",
              "Connection will stay open until closed by client or server",
            ],
            eventTypes: {
              ADDED: "Resource was created",
              MODIFIED: "Resource was updated",
              DELETED: "Resource was deleted",
              BOOKMARK: "Bookmark event (can be ignored)",
              ERROR: "Error occurred while watching",
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_watch", resource, namespace };
          const classified = classifyError(error, context);
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
  ];
}
