import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName, validateNamespace, validatePort } from "../validators.js";

export function registerNetworkingTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_services",
        description: "List all services",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const services = await k8sClient.listServices(namespace);
          return {
            services: services.map((svc: k8s.V1Service) => ({
              name: svc.metadata?.name,
              namespace: svc.metadata?.namespace,
              type: svc.spec?.type,
              clusterIP: svc.spec?.clusterIP,
              externalIPs: svc.spec?.externalIPs,
              externalName: svc.spec?.externalName,
              ports: svc.spec?.ports?.map((p: k8s.V1ServicePort) => ({
                name: p.name,
                port: p.port,
                targetPort: p.targetPort,
                protocol: p.protocol,
                nodePort: p.nodePort,
              })),
              selector: svc.spec?.selector,
              sessionAffinity: svc.spec?.sessionAffinity,
              age: svc.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_services", namespace };
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
    // Get Service
    {
      tool: {
        name: "k8s_get_service",
        description: "Get detailed information about a Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Service",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "service");
          const coreApi = k8sClient.getCoreV1Api();
          const [svcResult, endpointsResult] = await Promise.all([
            coreApi.readNamespacedService({ name, namespace: namespace || "default" }),
            coreApi.readNamespacedEndpoints({ name, namespace: namespace || "default" }).catch(() => null),
          ]);
          const svc = svcResult;

          return {
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            externalIPs: svc.spec?.externalIPs,
            externalName: svc.spec?.externalName,
            loadBalancerIP: svc.spec?.loadBalancerIP,
            selector: svc.spec?.selector,
            ports: svc.spec?.ports?.map((p: k8s.V1ServicePort) => ({
              name: p.name,
              port: p.port,
              targetPort: p.targetPort,
              protocol: p.protocol,
              nodePort: p.nodePort,
            })),
            sessionAffinity: svc.spec?.sessionAffinity,
            externalTrafficPolicy: svc.spec?.externalTrafficPolicy,
            healthCheckNodePort: svc.spec?.healthCheckNodePort,
            publishNotReadyAddresses: svc.spec?.publishNotReadyAddresses,
            status: {
              loadBalancer: svc.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
                ip: lb.ip,
                hostname: lb.hostname,
              })),
            },
            endpoints: endpointsResult?.subsets?.map((subset: k8s.V1EndpointSubset) => ({
              addresses: subset.addresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
                nodeName: a.nodeName,
                targetRef: a.targetRef?.name,
              })),
              ports: subset.ports?.map((p: k8s.CoreV1EndpointPort) => ({
                name: p.name,
                port: p.port,
                protocol: p.protocol,
              })),
            })) || [],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_service", resource: name, namespace };
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
    {
      tool: {
        name: "k8s_get_service_endpoints",
        description: "Get endpoints for a service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the service",
            },
            namespace: {
              type: "string",
              description: "Namespace of the service",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "service");
          const coreApi = k8sClient.getCoreV1Api();
          const [service, endpoints] = await Promise.all([
            coreApi.readNamespacedService({ name, namespace: namespace || "default" }),
            coreApi.readNamespacedEndpoints({ name, namespace: namespace || "default" }).catch(() => null),
          ]);

          return {
            service: {
              name: service.metadata?.name,
              namespace: service.metadata?.namespace,
              selector: service.spec?.selector,
              ports: service.spec?.ports,
            },
            endpoints: endpoints?.subsets?.map((subset: k8s.V1EndpointSubset) => ({
              addresses: subset.addresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
                nodeName: a.nodeName,
                targetRef: a.targetRef,
              })),
              notReadyAddresses: subset.notReadyAddresses?.map((a: k8s.V1EndpointAddress) => ({
                ip: a.ip,
                hostname: a.hostname,
              })),
              ports: subset.ports?.map((p: k8s.CoreV1EndpointPort) => ({
                name: p.name,
                port: p.port,
                protocol: p.protocol,
              })),
            })) || [],
            totalEndpoints: endpoints?.subsets?.reduce((sum: number, s: k8s.V1EndpointSubset) => 
              sum + (s.addresses?.length || 0), 0) || 0,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_service_endpoints", resource: name, namespace };
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
    {
      tool: {
        name: "k8s_list_ingresses",
        description: "List all Ingresses",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const ingresses = await k8sClient.listIngresses(namespace);
          return {
            ingresses: ingresses.map((ing: k8s.V1Ingress) => ({
              name: ing.metadata?.name,
              namespace: ing.metadata?.namespace,
              class: ing.spec?.ingressClassName,
              rules: ing.spec?.rules?.map((rule: k8s.V1IngressRule) => ({
                host: rule.host,
                paths: rule.http?.paths?.map((path: k8s.V1HTTPIngressPath) => ({
                  path: path.path,
                  pathType: path.pathType,
                  serviceName: path.backend?.service?.name,
                  servicePort: path.backend?.service?.port?.number || path.backend?.service?.port?.name,
                })),
              })),
              tls: ing.spec?.tls?.map((tls: k8s.V1IngressTLS) => ({
                hosts: tls.hosts,
                secretName: tls.secretName,
              })),
              loadBalancer: ing.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
                ip: lb.ip,
                hostname: lb.hostname,
              })),
              age: ing.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_ingresses", namespace };
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
    {
      tool: {
        name: "k8s_list_network_policies",
        description: "List all NetworkPolicies",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const response = namespace
            ? await netApi.listNamespacedNetworkPolicy({ namespace })
            : await netApi.listNetworkPolicyForAllNamespaces();
          
          return {
            networkPolicies: response.items.map((np: k8s.V1NetworkPolicy) => ({
              name: np.metadata?.name,
              namespace: np.metadata?.namespace,
              podSelector: np.spec?.podSelector,
              policyTypes: np.spec?.policyTypes,
              ingressRules: np.spec?.ingress?.length || 0,
              egressRules: np.spec?.egress?.length || 0,
              age: np.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_network_policies", namespace };
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
    // Get Ingress
    {
      tool: {
        name: "k8s_get_ingress",
        description: "Get detailed information about an Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Ingress",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "ingress");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ing = await netApi.readNamespacedIngress({ name, namespace: namespace || "default" });

          return {
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            ingressClassName: ing.spec?.ingressClassName,
            rules: ing.spec?.rules?.map((rule: k8s.V1IngressRule) => ({
              host: rule.host,
              paths: rule.http?.paths?.map((path: k8s.V1HTTPIngressPath) => ({
                path: path.path,
                pathType: path.pathType,
                service: {
                  name: path.backend?.service?.name,
                  port: path.backend?.service?.port?.number || path.backend?.service?.port?.name,
                },
              })),
            })),
            tls: ing.spec?.tls?.map((tls: k8s.V1IngressTLS) => ({
              hosts: tls.hosts,
              secretName: tls.secretName,
            })),
            status: {
              loadBalancer: ing.status?.loadBalancer?.ingress?.map((lb: k8s.V1LoadBalancerIngress) => ({
                ip: lb.ip,
                hostname: lb.hostname,
              })),
            },
            annotations: ing.metadata?.annotations,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_ingress", resource: name, namespace };
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
    // Get NetworkPolicy
    {
      tool: {
        name: "k8s_get_network_policy",
        description: "Get detailed information about a NetworkPolicy",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the NetworkPolicy",
            },
            namespace: {
              type: "string",
              description: "Namespace of the NetworkPolicy",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "networkpolicy");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const result = await netApi.readNamespacedNetworkPolicy({ name, namespace: namespace || "default" });
          const np = result;

          return {
            name: np.metadata?.name,
            namespace: np.metadata?.namespace,
            podSelector: np.spec?.podSelector,
            policyTypes: np.spec?.policyTypes,
            ingress: np.spec?.ingress?.map((rule: k8s.V1NetworkPolicyIngressRule) => ({
              from: (rule as any).from?.map((from: k8s.V1NetworkPolicyPeer) => ({
                podSelector: from.podSelector,
                namespaceSelector: from.namespaceSelector,
                ipBlock: from.ipBlock ? {
                  cidr: from.ipBlock.cidr,
                  except: from.ipBlock.except,
                } : undefined,
              })),
              ports: rule.ports?.map((port: k8s.V1NetworkPolicyPort) => ({
                protocol: port.protocol,
                port: port.port,
              })),
            })),
            egress: np.spec?.egress?.map((rule: k8s.V1NetworkPolicyEgressRule) => ({
              to: rule.to?.map((to: k8s.V1NetworkPolicyPeer) => ({
                podSelector: to.podSelector,
                namespaceSelector: to.namespaceSelector,
                ipBlock: to.ipBlock ? {
                  cidr: to.ipBlock.cidr,
                  except: to.ipBlock.except,
                } : undefined,
              })),
              ports: rule.ports?.map((port: k8s.V1NetworkPolicyPort) => ({
                protocol: port.protocol,
                port: port.port,
              })),
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_network_policy", resource: name, namespace };
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
    {
      tool: {
        name: "k8s_test_dns",
        description: "Test DNS resolution within the cluster",
        inputSchema: {
          type: "object",
          properties: {
            hostname: {
              type: "string",
              description: "Hostname to resolve",
            },
            namespace: {
              type: "string",
              description: "Namespace context for short names",
              default: "default",
            },
          },
          required: ["hostname"],
        },
      },
      handler: async ({ hostname, namespace }: { hostname: string; namespace?: string }) => {
        // Create a temporary pod to test DNS resolution
        const coreApi = k8sClient.getCoreV1Api();
        const testPodName = `dns-test-${Date.now()}`;
        const ns = namespace || "default";
        
        const pod: k8s.V1Pod = {
          apiVersion: "v1",
          kind: "Pod",
          metadata: {
            name: testPodName,
            namespace: ns,
          },
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "dns-test",
                image: "busybox:latest",
                command: ["nslookup", hostname],
              },
            ],
          },
        };

        try {
          await coreApi.createNamespacedPod({ namespace: ns, body: pod });
          
          // Wait for pod completion (simplified - in production use watch)
          await new Promise((resolve) => setTimeout(resolve, 5000));
          
          const podStatus = await coreApi.readNamespacedPod({ name: testPodName, namespace: ns });
          const logs = await coreApi.readNamespacedPodLog({ name: testPodName, namespace: ns });
          
          // Clean up
          await coreApi.deleteNamespacedPod({ name: testPodName, namespace: ns });
          
          const succeeded = podStatus.status?.phase === "Succeeded";
          
          return {
            hostname,
            namespace: ns,
            resolved: succeeded,
            logs: logs,
            message: succeeded 
              ? `DNS resolution for ${hostname} succeeded`
              : `DNS resolution for ${hostname} failed`,
          };
        } catch (error) {
          // Clean up on error
          try {
            await coreApi.deleteNamespacedPod({ name: testPodName, namespace: ns });
          } catch {}
          
          const context: ErrorContext = { operation: "k8s_test_dns", resource: hostname, namespace: ns };
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
    {
      tool: {
        name: "k8s_service_topology",
        description: "Show service-to-pod mapping for visualization",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to analyze",
              default: "default",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        try {
          const ns = namespace || "default";
          const coreApi = k8sClient.getCoreV1Api();
          
          const [services, pods] = await Promise.all([
            coreApi.listNamespacedService({ namespace: ns }),
            coreApi.listNamespacedPod({ namespace: ns }),
          ]);

          const topology = services.items.map((svc: k8s.V1Service) => {
            const selector = svc.spec?.selector || {};
            
            // Find matching pods
            const matchingPods = pods.items.filter((pod: k8s.V1Pod) => {
              const labels = pod.metadata?.labels || {};
              return Object.entries(selector).every(([key, value]) => labels[key] === value);
            });

            return {
              service: {
                name: svc.metadata?.name,
                type: svc.spec?.type,
                clusterIP: svc.spec?.clusterIP,
                selector: svc.spec?.selector,
              },
              endpoints: matchingPods.map((pod: k8s.V1Pod) => ({
                podName: pod.metadata?.name,
                podIP: pod.status?.podIP,
                status: pod.status?.phase,
                ready: pod.status?.containerStatuses?.every((c: k8s.V1ContainerStatus) => c.ready),
              })),
              endpointCount: matchingPods.length,
            };
          });

          return {
            namespace: ns,
            services: topology,
            totalServices: topology.length,
            servicesWithEndpoints: topology.filter((t) => t.endpointCount > 0).length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_service_topology", namespace };
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
    // Delete Service
    {
      tool: {
        name: "k8s_delete_service",
        description: "Delete a Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Service",
              default: "default",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for termination",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, gracePeriodSeconds }: { 
        name: string; 
        namespace?: string;
        gracePeriodSeconds?: number;
      }) => {
        try {
          validateResourceName(name, "service");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await coreApi.deleteNamespacedService({ name, namespace: ns, ...options });
          
          return {
            success: true,
            message: `Service ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_service", resource: name, namespace };
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
    // Delete Ingress
    {
      tool: {
        name: "k8s_delete_ingress",
        description: "Delete an Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Ingress",
              default: "default",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for termination",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, gracePeriodSeconds }: { 
        name: string; 
        namespace?: string;
        gracePeriodSeconds?: number;
      }) => {
        try {
          validateResourceName(name, "ingress");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await netApi.deleteNamespacedIngress({ name, namespace: ns, ...options });
          
          return {
            success: true,
            message: `Ingress ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_ingress", resource: name, namespace };
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
    // Create Service
    {
      tool: {
        name: "k8s_create_service",
        description: "Create a new Kubernetes Service",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Service",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Service",
              default: "default",
            },
            type: {
              type: "string",
              description: "Service type (ClusterIP, NodePort, LoadBalancer, ExternalName)",
              enum: ["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"],
              default: "ClusterIP",
            },
            selector: {
              type: "object",
              description: "Label selector for targeting pods (e.g., {app: 'nginx'})",
            },
            ports: {
              type: "array",
              description: "Service ports",
              items: {
                type: "object",
                properties: {
                  port: { type: "number" },
                  targetPort: { type: "number" },
                  protocol: { type: "string", default: "TCP" },
                  name: { type: "string" },
                },
              },
            },
            externalName: {
              type: "string",
              description: "External name for ExternalName type service",
            },
          },
          required: ["name", "ports"],
        },
      },
      handler: async ({ name, namespace, type, selector, ports, externalName }: { 
        name: string; 
        namespace?: string; 
        type?: string;
        selector?: Record<string, string>;
        ports: any[];
        externalName?: string;
      }) => {
        try {
          validateResourceName(name, "service");
          if (namespace) {
            validateNamespace(namespace);
          }
          // Validate ports
          for (const p of ports) {
            if (p.port) {
              validatePort(p.port);
            }
            if (p.targetPort && typeof p.targetPort === 'number') {
              validatePort(p.targetPort);
            }
          }
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const service: k8s.V1Service = {
            apiVersion: "v1",
            kind: "Service",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              type: type || "ClusterIP",
              selector: selector || {},
              ports: ports.map((p: any) => ({
                port: p.port,
                targetPort: p.targetPort || p.port,
                protocol: p.protocol || "TCP",
                name: p.name || `port-${p.port}`,
              })),
              ...(externalName && type === "ExternalName" ? { externalName } : {}),
            },
          };
          
          const result = await coreApi.createNamespacedService({ namespace: ns, body: service }, {});
          
          return {
            success: true,
            message: `Service ${name} created in namespace ${ns}`,
            service: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              type: result.spec?.type,
              clusterIP: result.spec?.clusterIP,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_service", resource: name, namespace };
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
    // Expose - Create service from deployment/pod
    {
      tool: {
        name: "k8s_expose",
        description: "Expose a deployment or pod as a service (like kubectl expose)",
        inputSchema: {
          type: "object",
          properties: {
            resource: {
              type: "string",
              description: "Resource type (deployment, pod, replicaset, replicationcontroller)",
              enum: ["deployment", "pod", "replicaset", "replicationcontroller"],
            },
            name: {
              type: "string",
              description: "Name of the resource to expose",
            },
            namespace: {
              type: "string",
              description: "Namespace",
              default: "default",
            },
            port: {
              type: "number",
              description: "Service port",
            },
            targetPort: {
              type: "number",
              description: "Target port on pods (defaults to port)",
            },
            type: {
              type: "string",
              description: "Service type",
              enum: ["ClusterIP", "NodePort", "LoadBalancer"],
              default: "ClusterIP",
            },
            serviceName: {
              type: "string",
              description: "Name for the created service (defaults to resource name)",
            },
          },
          required: ["resource", "name", "port"],
        },
      },
      handler: async ({ resource, name, namespace, port, targetPort, type, serviceName }: { 
        resource: string; 
        name: string; 
        namespace?: string;
        port: number;
        targetPort?: number;
        type?: string;
        serviceName?: string;
      }) => {
        try {
          validateResourceName(name, resource);
          validatePort(port);
          if (targetPort) {
            validatePort(targetPort);
          }
          if (namespace) {
            validateNamespace(namespace);
          }
          const coreApi = k8sClient.getCoreV1Api();
          const appsApi = (k8sClient as any).kc.makeApiClient(k8s.AppsV1Api);
          const ns = namespace || "default";
          
          // Get the resource to extract its selector
          let selector: Record<string, string> = {};
          
          switch (resource.toLowerCase()) {
            case "deployment":
              const deploy = await appsApi.readNamespacedDeployment({ name, namespace: ns }, {});
              selector = deploy.spec?.selector?.matchLabels || {};
              break;
            case "pod":
              const pod = await coreApi.readNamespacedPod({ name, namespace: ns }, {});
              selector = pod.metadata?.labels || {};
              // Remove pod-specific labels that shouldn't be used as selectors
              delete selector["controller-uid"];
              delete selector["job-name"];
              break;
            case "replicaset":
              const rs = await appsApi.readNamespacedReplicaSet({ name, namespace: ns }, {});
              selector = rs.spec?.selector?.matchLabels || {};
              break;
            default:
              return {
                success: false,
                error: `Resource type '${resource}' not supported for expose`,
              };
          }
          
          if (Object.keys(selector).length === 0) {
            return {
              success: false,
              error: `No selector found for ${resource}/${name}`,
            };
          }
          
          // Create the service
          const svcName = serviceName || name;
          const service: k8s.V1Service = {
            apiVersion: "v1",
            kind: "Service",
            metadata: {
              name: svcName,
              namespace: ns,
            },
            spec: {
              type: type || "ClusterIP",
              selector,
              ports: [{
                port,
                targetPort: targetPort || port,
                protocol: "TCP",
              }],
            },
          };
          
          const result = await coreApi.createNamespacedService({ namespace: ns, body: service }, {});
          
          return {
            success: true,
            message: `Exposed ${resource}/${name} as service ${svcName}`,
            service: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              type: result.spec?.type,
              clusterIP: result.spec?.clusterIP,
              selector,
              ports: [{ port, targetPort: targetPort || port }],
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_expose", resource: name, namespace };
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
    // Create Ingress
    {
      tool: {
        name: "k8s_create_ingress",
        description: "Create a new Kubernetes Ingress",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Ingress",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Ingress",
              default: "default",
            },
            rules: {
              type: "array",
              description: "Ingress rules",
              items: {
                type: "object",
                properties: {
                  host: { type: "string" },
                  paths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", default: "/" },
                        pathType: { type: "string", enum: ["Prefix", "Exact", "ImplementationSpecific"], default: "Prefix" },
                        serviceName: { type: "string" },
                        servicePort: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
            tls: {
              type: "array",
              description: "TLS configuration",
              items: {
                type: "object",
                properties: {
                  hosts: { type: "array", items: { type: "string" } },
                  secretName: { type: "string" },
                },
              },
            },
            annotations: {
              type: "object",
              description: "Ingress annotations (e.g., nginx.ingress.kubernetes.io/rewrite-target)",
            },
          },
          required: ["name", "rules"],
        },
      },
      handler: async ({ name, namespace, rules, tls, annotations }: { 
        name: string; 
        namespace?: string;
        rules: any[];
        tls?: any[];
        annotations?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "ingress");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ns = namespace || "default";
          
          const ingress: k8s.V1Ingress = {
            apiVersion: "networking.k8s.io/v1",
            kind: "Ingress",
            metadata: {
              name,
              namespace: ns,
              annotations,
            },
            spec: {
              rules: rules.map((rule: any) => ({
                host: rule.host,
                http: {
                  paths: rule.paths.map((p: any) => ({
                    path: p.path || "/",
                    pathType: p.pathType || "Prefix",
                    backend: {
                      service: {
                        name: p.serviceName,
                        port: {
                          number: p.servicePort,
                        },
                      },
                    },
                  })),
                },
              })),
              tls: tls?.map((t: any) => ({
                hosts: t.hosts,
                secretName: t.secretName,
              })),
            },
          };
          
          const result = await netApi.createNamespacedIngress({ namespace: ns, body: ingress }, {});
          
          return {
            success: true,
            message: `Ingress ${name} created in namespace ${ns}`,
            ingress: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              rules: result.spec?.rules?.length,
              tls: result.spec?.tls?.length || 0,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_ingress", resource: name, namespace };
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
    // Create NetworkPolicy
    {
      tool: {
        name: "k8s_create_networkpolicy",
        description: "Create a Kubernetes NetworkPolicy to control traffic flow",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the NetworkPolicy",
            },
            namespace: {
              type: "string",
              description: "Namespace for the NetworkPolicy",
              default: "default",
            },
            podSelector: {
              type: "object",
              description: "Pod selector labels (empty = all pods in namespace)",
            },
            policyTypes: {
              type: "array",
              description: "Policy types (Ingress, Egress, or both)",
              items: { type: "string", enum: ["Ingress", "Egress"] },
              default: ["Ingress"],
            },
            ingress: {
              type: "array",
              description: "Ingress rules (allowed incoming traffic)",
              items: {
                type: "object",
                properties: {
                  from: { type: "array" },
                  ports: { type: "array" },
                },
              },
            },
            egress: {
              type: "array",
              description: "Egress rules (allowed outgoing traffic)",
              items: {
                type: "object",
                properties: {
                  to: { type: "array" },
                  ports: { type: "array" },
                },
              },
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, podSelector, policyTypes, ingress, egress }: { 
        name: string; 
        namespace?: string;
        podSelector?: Record<string, string>;
        policyTypes?: string[];
        ingress?: any[];
        egress?: any[];
      }) => {
        try {
          validateResourceName(name, "networkpolicy");
          const netApi = (k8sClient as any).kc.makeApiClient(k8s.NetworkingV1Api);
          const ns = namespace || "default";
          
          const networkPolicy: k8s.V1NetworkPolicy = {
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: {
              name,
              namespace: ns,
            },
            spec: {
              podSelector: {
                matchLabels: podSelector || {},
              },
              policyTypes: policyTypes || ["Ingress"],
              ingress: ingress || [],
              egress: egress || [],
            },
          };
          
          const result = await netApi.createNamespacedNetworkPolicy({ namespace: ns, body: networkPolicy }, {});
          
          return {
            success: true,
            message: `NetworkPolicy ${name} created in namespace ${ns}`,
            networkPolicy: {
              name: result.metadata?.name,
              namespace: result.metadata?.namespace,
              podSelector: result.spec?.podSelector?.matchLabels,
              policyTypes: result.spec?.policyTypes,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_networkpolicy", resource: name, namespace };
          const classified = classifyError(error, context);
          
          // Add Calico/AKS specific suggestions
          const calicoSuggestions = [
            "For Calico on AKS, try a minimal NetworkPolicy with empty podSelector",
            "Example: { podSelector: {}, policyTypes: ['Ingress'] }",
            "Calico may require specific ingress/egress rule formats",
            "Check Calico network policy documentation for AKS",
            "Use kubectl describe networkpolicy <name> to see detailed errors"
          ];
          
          return {
            success: false,
            error: classified.message,
            type: classified.type,
            suggestions: [...(classified.suggestions || []), ...calicoSuggestions],
          };
        }
      },
    },
    // List Endpoints
    {
      tool: {
        name: "k8s_list_endpoints",
        description: "List Endpoints for services (like kubectl get endpoints)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (default: all namespaces)",
            },
            service: {
              type: "string",
              description: "Filter by service name",
            },
          },
        },
      },
      handler: async ({ namespace, service }: { namespace?: string; service?: string }) => {
        try {
          const coreApi = k8sClient.getCoreV1Api();
          let endpoints: k8s.V1Endpoints[] = [];
          
          if (service && namespace) {
            // Get specific endpoints for a service
            const ep = await coreApi.readNamespacedEndpoints({ name: service, namespace });
            endpoints = [ep];
          } else if (namespace) {
            const result = await coreApi.listNamespacedEndpoints({ namespace });
            endpoints = result.items || [];
          } else {
            const result = await coreApi.listEndpointsForAllNamespaces();
            endpoints = result.items || [];
          }
          
          return {
            endpoints: endpoints.map((ep: k8s.V1Endpoints) => ({
              name: ep.metadata?.name,
              namespace: ep.metadata?.namespace,
              service: ep.metadata?.name, // Endpoints name matches service name
              subsets: (ep.subsets || []).map((subset: any) => ({
                addresses: (subset.addresses || []).map((a: any) => ({
                  ip: a.ip,
                  hostname: a.hostname,
                  nodeName: a.nodeName,
                  targetRef: a.targetRef?.name,
                })),
                ports: (subset.ports || []).map((p: any) => ({
                  port: p.port,
                  name: p.name,
                  protocol: p.protocol,
                })),
              })),
            })),
            total: endpoints.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_endpoints", namespace };
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
    // List EndpointSlices
    {
      tool: {
        name: "k8s_list_endpointslice",
        description: "List EndpointSlices (modern replacement for Endpoints, like kubectl get endpointslice)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace (default: all namespaces)",
            },
            service: {
              type: "string",
              description: "Filter by service name (label selector)",
            },
          },
        },
      },
      handler: async ({ namespace, service }: { namespace?: string; service?: string }) => {
        try {
          const rawClient = k8sClient as any;
          let path: string;
          
          if (namespace) {
            path = `/apis/discovery.k8s.io/v1/namespaces/${namespace}/endpointslices`;
          } else {
            path = "/apis/discovery.k8s.io/v1/endpointslices";
          }
          
          const result = await rawClient.rawApiRequest(path);
          let slices = result.items || [];
          
          // Filter by service name if provided
          if (service) {
            slices = slices.filter((slice: any) => 
              slice.metadata?.labels?.["kubernetes.io/service-name"] === service
            );
          }
          
          return {
            endpointSlices: slices.map((slice: any) => ({
              name: slice.metadata?.name,
              namespace: slice.metadata?.namespace,
              service: slice.metadata?.labels?.["kubernetes.io/service-name"],
              addressType: slice.addressType,
              endpoints: (slice.endpoints || []).map((ep: any) => ({
                addresses: ep.addresses,
                conditions: ep.conditions,
                hostname: ep.hostname,
                nodeName: ep.nodeName,
                targetRef: ep.targetRef?.name,
              })),
              ports: (slice.ports || []).map((p: any) => ({
                port: p.port,
                name: p.name,
                protocol: p.protocol,
                appProtocol: p.appProtocol,
              })),
            })),
            total: slices.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_endpointslice", namespace };
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
    // List IngressClasses
    {
      tool: {
        name: "k8s_list_ingressclass",
        description: "List IngressClasses (like kubectl get ingressclass)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const rawClient = k8sClient as any;
          const result = await rawClient.rawApiRequest("/apis/networking.k8s.io/v1/ingressclasses");
          
          const ingressClasses = result.items || [];
          
          return {
            ingressClasses: ingressClasses.map((ic: any) => ({
              name: ic.metadata?.name,
              controller: ic.spec?.controller,
              isDefault: ic.metadata?.annotations?.["ingressclass.kubernetes.io/is-default-class"] === "true",
              parameters: ic.spec?.parameters,
              apiGroup: ic.spec?.parameters?.apiGroup,
              kind: ic.spec?.parameters?.kind,
            })),
            total: ingressClasses.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_ingressclass" };
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
