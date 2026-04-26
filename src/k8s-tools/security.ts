import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as k8s from "@kubernetes/client-node";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName } from "../validators.js";

export function registerSecurityTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_serviceaccounts",
        description: "List all ServiceAccounts",
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
          const sas = await k8sClient.listServiceAccounts(namespace);
          return {
            serviceAccounts: sas.map((sa: k8s.V1ServiceAccount) => ({
              name: sa.metadata?.name,
              namespace: sa.metadata?.namespace,
              secrets: sa.secrets?.map((s: k8s.V1ObjectReference) => s.name),
              automountServiceAccountToken: sa.automountServiceAccountToken,
              age: sa.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_serviceaccounts", namespace };
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
        name: "k8s_list_roles",
        description: "List all Roles",
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
          const roles = await k8sClient.listRoles(namespace);
          return {
            roles: roles.map((r: k8s.V1Role) => ({
              name: r.metadata?.name,
              namespace: r.metadata?.namespace,
              rules: r.rules?.map((rule: k8s.V1PolicyRule) => ({
                verbs: rule.verbs,
                apiGroups: rule.apiGroups,
                resources: rule.resources,
                resourceNames: rule.resourceNames,
              })),
              age: r.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_roles", namespace };
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
        name: "k8s_list_clusterroles",
        description: "List all ClusterRoles",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const roles = await k8sClient.listClusterRoles();
          return {
            clusterRoles: roles.map((r: k8s.V1ClusterRole) => ({
              name: r.metadata?.name,
              rules: r.rules?.map((rule: k8s.V1PolicyRule) => ({
                verbs: rule.verbs,
                apiGroups: rule.apiGroups,
                resources: rule.resources,
                resourceNames: rule.resourceNames,
              })),
              aggregationRule: r.aggregationRule,
              age: r.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_clusterroles" };
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
        name: "k8s_list_rolebindings",
        description: "List all RoleBindings",
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
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const response = namespace
            ? await rbacApi.listNamespacedRoleBinding(namespace)
            : await rbacApi.listRoleBindingForAllNamespaces();
          
          return {
            roleBindings: response.body.items.map((rb: k8s.V1RoleBinding) => ({
              name: rb.metadata?.name,
              namespace: rb.metadata?.namespace,
              roleRef: {
                kind: rb.roleRef?.kind,
                name: rb.roleRef?.name,
              },
              subjects: rb.subjects?.map((s: k8s.V1Subject) => ({
                kind: s.kind,
                name: s.name,
                namespace: s.namespace,
              })),
              age: rb.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_rolebindings", namespace };
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
        name: "k8s_list_clusterrolebindings",
        description: "List all ClusterRoleBindings",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const response = await rbacApi.listClusterRoleBinding();
          
          return {
            clusterRoleBindings: response.body.items.map((crb: k8s.V1ClusterRoleBinding) => ({
              name: crb.metadata?.name,
              roleRef: {
                kind: crb.roleRef?.kind,
                name: crb.roleRef?.name,
              },
              subjects: crb.subjects?.map((s: k8s.V1Subject) => ({
                kind: s.kind,
                name: s.name,
                namespace: s.namespace,
              })),
              age: crb.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_clusterrolebindings" };
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
        name: "k8s_list_secrets",
        description: "List all Secrets (values are masked)",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter",
            },
            type: {
              type: "string",
              description: "Filter by secret type (e.g., kubernetes.io/tls, Opaque)",
            },
          },
        },
      },
      handler: async ({ namespace, type }: { namespace?: string; type?: string }) => {
        try {
          const secrets = await k8sClient.listSecrets(namespace);
          
          const filtered = type ? secrets.filter((s: k8s.V1Secret) => s.type === type) : secrets;
          
          return {
            secrets: filtered.map((s: k8s.V1Secret) => ({
              name: s.metadata?.name,
              namespace: s.metadata?.namespace,
              type: s.type,
              dataKeys: Object.keys(s.data || {}),
              dataSize: Object.values(s.data || {}).reduce((sum: number, v: any) => sum + (v?.length || 0), 0),
              immutable: s.immutable,
              age: s.metadata?.creationTimestamp,
            })),
            total: filtered.length,
            byType: filtered.reduce((acc: Record<string, number>, s: k8s.V1Secret) => {
              acc[s.type || "Opaque"] = (acc[s.type || "Opaque"] || 0) + 1;
              return acc;
            }, {}),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_secrets", namespace };
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
        name: "k8s_list_configmaps",
        description: "List all ConfigMaps",
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
          const cms = await k8sClient.listConfigMaps(namespace);
          return {
            configMaps: cms.map((cm: k8s.V1ConfigMap) => ({
              name: cm.metadata?.name,
              namespace: cm.metadata?.namespace,
              dataKeys: Object.keys(cm.data || {}),
              binaryDataKeys: Object.keys(cm.binaryData || {}),
              immutable: cm.immutable,
              age: cm.metadata?.creationTimestamp,
            })),
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_configmaps", namespace };
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
    // Get Secret
    {
      tool: {
        name: "k8s_get_secret",
        description: "Get detailed information about a Secret (values are masked)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Secret",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Secret",
              default: "default",
            },
            decode: {
              type: "boolean",
              description: "Decode base64 values (use with caution)",
              default: false,
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, decode }: { name: string; namespace?: string; decode?: boolean }) => {
        try {
          validateResourceName(name, "secret");
          const coreApi = k8sClient.getCoreV1Api();
          const result = await coreApi.readNamespacedSecret(name, namespace || "default");
          const secret = result.body;

          const data = secret.data || {};
          const decodedData = decode
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, Buffer.from(v || "", "base64").toString("utf8")])
              )
            : Object.fromEntries(Object.keys(data).map((k) => [k, "***MASKED***"]));

          return {
            name: secret.metadata?.name,
            namespace: secret.metadata?.namespace,
            type: secret.type,
            data: decodedData,
            dataKeys: Object.keys(data),
            immutable: secret.immutable,
            annotations: secret.metadata?.annotations,
            age: secret.metadata?.creationTimestamp,
            warning: decode ? "Decoded values exposed - handle with care" : undefined,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_secret", resource: name, namespace };
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
    // Get ServiceAccount
    {
      tool: {
        name: "k8s_get_serviceaccount",
        description: "Get detailed information about a ServiceAccount",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ServiceAccount",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ServiceAccount",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "serviceaccount");
          const coreApi = k8sClient.getCoreV1Api();
          const result = await coreApi.readNamespacedServiceAccount(name, namespace || "default");
          const sa = result.body;

          return {
            name: sa.metadata?.name,
            namespace: sa.metadata?.namespace,
            automountServiceAccountToken: sa.automountServiceAccountToken,
            secrets: sa.secrets?.map((s: k8s.V1ObjectReference) => ({
              name: s.name,
            })),
            imagePullSecrets: sa.imagePullSecrets?.map((s: k8s.V1LocalObjectReference) => ({
              name: s.name,
            })),
            annotations: sa.metadata?.annotations,
            labels: sa.metadata?.labels,
            age: sa.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_serviceaccount", resource: name, namespace };
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
    // Get Role
    {
      tool: {
        name: "k8s_get_role",
        description: "Get detailed information about a Role",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Role",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Role",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "role");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const result = await rbacApi.readNamespacedRole(name, namespace || "default");
          const role = result.body;

          return {
            name: role.metadata?.name,
            namespace: role.metadata?.namespace,
            rules: role.rules?.map((rule: k8s.V1PolicyRule) => ({
              verbs: rule.verbs,
              apiGroups: rule.apiGroups,
              resources: rule.resources,
              resourceNames: rule.resourceNames,
              nonResourceURLs: rule.nonResourceURLs,
            })),
            annotations: role.metadata?.annotations,
            labels: role.metadata?.labels,
            age: role.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_role", resource: name, namespace };
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
    // Get ClusterRole
    {
      tool: {
        name: "k8s_get_clusterrole",
        description: "Get detailed information about a ClusterRole",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRole",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name }: { name: string }) => {
        try {
          validateResourceName(name, "clusterrole");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const result = await rbacApi.readClusterRole(name);
          const cr = result.body;

          return {
            name: cr.metadata?.name,
            rules: cr.rules?.map((rule: k8s.V1PolicyRule) => ({
              verbs: rule.verbs,
              apiGroups: rule.apiGroups,
              resources: rule.resources,
              resourceNames: rule.resourceNames,
              nonResourceURLs: rule.nonResourceURLs,
            })),
            aggregationRule: cr.aggregationRule,
            annotations: cr.metadata?.annotations,
            labels: cr.metadata?.labels,
            age: cr.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_clusterrole", resource: name };
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
    // Get RoleBinding
    {
      tool: {
        name: "k8s_get_rolebinding",
        description: "Get detailed information about a RoleBinding",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the RoleBinding",
            },
            namespace: {
              type: "string",
              description: "Namespace of the RoleBinding",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        try {
          validateResourceName(name, "rolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const result = await rbacApi.readNamespacedRoleBinding(name, namespace || "default");
          const rb = result.body;

          return {
            name: rb.metadata?.name,
            namespace: rb.metadata?.namespace,
            roleRef: {
              kind: rb.roleRef?.kind,
              name: rb.roleRef?.name,
              apiGroup: rb.roleRef?.apiGroup,
            },
            subjects: rb.subjects?.map((s: k8s.V1Subject) => ({
              kind: s.kind,
              name: s.name,
              namespace: s.namespace,
              apiGroup: s.apiGroup,
            })),
            annotations: rb.metadata?.annotations,
            labels: rb.metadata?.labels,
            age: rb.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_rolebinding", resource: name, namespace };
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
    // Get ClusterRoleBinding
    {
      tool: {
        name: "k8s_get_clusterrolebinding",
        description: "Get detailed information about a ClusterRoleBinding",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRoleBinding",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name }: { name: string }) => {
        try {
          validateResourceName(name, "clusterrolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const result = await rbacApi.readClusterRoleBinding(name);
          const crb = result.body;

          return {
            name: crb.metadata?.name,
            roleRef: {
              kind: crb.roleRef?.kind,
              name: crb.roleRef?.name,
              apiGroup: crb.roleRef?.apiGroup,
            },
            subjects: crb.subjects?.map((s: k8s.V1Subject) => ({
              kind: s.kind,
              name: s.name,
              namespace: s.namespace,
              apiGroup: s.apiGroup,
            })),
            annotations: crb.metadata?.annotations,
            labels: crb.metadata?.labels,
            age: crb.metadata?.creationTimestamp,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_get_clusterrolebinding", resource: name };
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
        name: "k8s_get_configmap",
        description: "Get detailed ConfigMap data",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ConfigMap",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ConfigMap",
              default: "default",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace }: { name: string; namespace?: string }) => {
        const coreApi = k8sClient.getCoreV1Api();
        const cm = await coreApi.readNamespacedConfigMap(name, namespace || "default");
        
        return {
          name: cm.body.metadata?.name,
          namespace: cm.body.metadata?.namespace,
          data: cm.body.data,
          binaryData: cm.body.binaryData ? "<binary data present>" : null,
          immutable: cm.body.immutable,
          age: cm.body.metadata?.creationTimestamp,
        };
      },
    },
    {
      tool: {
        name: "k8s_get_rbac_summary",
        description: "Get RBAC summary for a user or service account",
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              description: "Type of subject (User, Group, ServiceAccount)",
              enum: ["User", "Group", "ServiceAccount"],
            },
            name: {
              type: "string",
              description: "Name of the subject",
            },
            namespace: {
              type: "string",
              description: "Namespace (for ServiceAccount)",
            },
          },
          required: ["kind", "name"],
        },
      },
      handler: async ({ kind, name, namespace }: { kind: string; name: string; namespace?: string }) => {
        const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
        
        // Get all role bindings
        const [roleBindings, clusterRoleBindings] = await Promise.all([
          rbacApi.listRoleBindingForAllNamespaces(),
          rbacApi.listClusterRoleBinding(),
        ]);

        // Find bindings for this subject
        const subjectFilter = (s: k8s.V1Subject) => {
          if (s.kind !== kind) return false;
          if (s.name !== name) return false;
          if (kind === "ServiceAccount" && s.namespace !== namespace) return false;
          return true;
        };

        const matchingRoleBindings = roleBindings.body.items.filter((rb: k8s.V1RoleBinding) => 
          rb.subjects?.some(subjectFilter)
        );
        
        const matchingClusterRoleBindings = clusterRoleBindings.body.items.filter((crb: k8s.V1ClusterRoleBinding) => 
          crb.subjects?.some(subjectFilter)
        );

        return {
          subject: { kind, name, namespace },
          roleBindings: matchingRoleBindings.map((rb: k8s.V1RoleBinding) => ({
            name: rb.metadata?.name,
            namespace: rb.metadata?.namespace,
            role: rb.roleRef.name,
            roleKind: rb.roleRef.kind,
          })),
          clusterRoleBindings: matchingClusterRoleBindings.map((crb: k8s.V1ClusterRoleBinding) => ({
            name: crb.metadata?.name,
            clusterRole: crb.roleRef.name,
          })),
          totalPermissions: matchingRoleBindings.length + matchingClusterRoleBindings.length,
        };
      },
    },
    {
      tool: {
        name: "k8s_check_privileged_pods",
        description: "Find pods running with privileged security contexts",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to check",
            },
          },
        },
      },
      handler: async ({ namespace }: { namespace?: string }) => {
        const pods = await k8sClient.listPods(namespace);
        
        const privileged = pods.filter((pod: k8s.V1Pod) => {
          const spec = pod.spec;
          // Check pod-level security context
          if (spec?.securityContext?.runAsNonRoot === false) return true;
          
          // Check container-level security contexts
          const containers = [...(spec?.containers || []), ...(spec?.initContainers || [])];
          return containers.some((c: k8s.V1Container) => {
            const sc = c.securityContext;
            if (sc?.privileged) return true;
            if (sc?.runAsUser === 0) return true;
            if (sc?.allowPrivilegeEscalation === true) return true;
            if (sc?.capabilities?.add?.some((cap: string) => 
              ["SYS_ADMIN", "SYS_PTRACE", "SYS_MODULE", "DAC_READ_SEARCH"].includes(cap)
            )) return true;
            return false;
          });
        });

        return {
          totalPods: pods.length,
          privilegedPods: privileged.length,
          pods: privileged.map((pod: k8s.V1Pod) => ({
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace,
            securityIssues: getSecurityIssues(pod),
          })),
        };
      },
    },
    // Delete ServiceAccount
    {
      tool: {
        name: "k8s_delete_serviceaccount",
        description: "Delete a ServiceAccount",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ServiceAccount to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the ServiceAccount",
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
          validateResourceName(name, "serviceaccount");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await coreApi.deleteNamespacedServiceAccount(name, ns, undefined, options);
          
          return {
            success: true,
            message: `ServiceAccount ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_serviceaccount", resource: name, namespace };
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
    // Delete Role
    {
      tool: {
        name: "k8s_delete_role",
        description: "Delete a Role",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Role to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the Role",
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
          validateResourceName(name, "role");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await rbacApi.deleteNamespacedRole(name, ns, undefined, options);
          
          return {
            success: true,
            message: `Role ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_role", resource: name, namespace };
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
    // Delete ClusterRole
    {
      tool: {
        name: "k8s_delete_clusterrole",
        description: "Delete a ClusterRole",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRole to delete",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for termination",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, gracePeriodSeconds }: { 
        name: string; 
        gracePeriodSeconds?: number;
      }) => {
        try {
          validateResourceName(name, "clusterrole");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await rbacApi.deleteClusterRole(name, undefined, options);
          
          return {
            success: true,
            message: `ClusterRole ${name} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_clusterrole", resource: name };
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
    // Delete RoleBinding
    {
      tool: {
        name: "k8s_delete_rolebinding",
        description: "Delete a RoleBinding",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the RoleBinding to delete",
            },
            namespace: {
              type: "string",
              description: "Namespace of the RoleBinding",
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
          validateResourceName(name, "rolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const ns = namespace || "default";
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await rbacApi.deleteNamespacedRoleBinding(name, ns, undefined, options);
          
          return {
            success: true,
            message: `RoleBinding ${name} in namespace ${ns} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_rolebinding", resource: name, namespace };
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
    // Delete ClusterRoleBinding
    {
      tool: {
        name: "k8s_delete_clusterrolebinding",
        description: "Delete a ClusterRoleBinding",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRoleBinding to delete",
            },
            gracePeriodSeconds: {
              type: "number",
              description: "Grace period for termination",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, gracePeriodSeconds }: { 
        name: string; 
        gracePeriodSeconds?: number;
      }) => {
        try {
          validateResourceName(name, "clusterrolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          
          const options: any = {};
          if (gracePeriodSeconds !== undefined) {
            options.gracePeriodSeconds = gracePeriodSeconds;
          }
          
          await rbacApi.deleteClusterRoleBinding(name, undefined, options);
          
          return {
            success: true,
            message: `ClusterRoleBinding ${name} deleted`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_delete_clusterrolebinding", resource: name };
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
    // Create ServiceAccount
    {
      tool: {
        name: "k8s_create_serviceaccount",
        description: "Create a Kubernetes ServiceAccount",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ServiceAccount",
            },
            namespace: {
              type: "string",
              description: "Namespace for the ServiceAccount",
              default: "default",
            },
            automountToken: {
              type: "boolean",
              description: "Allow automounting service account token",
              default: true,
            },
            labels: {
              type: "object",
              description: "Labels to apply",
            },
            annotations: {
              type: "object",
              description: "Annotations to apply",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, namespace, automountToken, labels, annotations }: { 
        name: string; 
        namespace?: string;
        automountToken?: boolean;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "serviceaccount");
          const coreApi = k8sClient.getCoreV1Api();
          const ns = namespace || "default";
          
          const serviceAccount: k8s.V1ServiceAccount = {
            apiVersion: "v1",
            kind: "ServiceAccount",
            metadata: {
              name,
              namespace: ns,
              labels,
              annotations,
            },
            automountServiceAccountToken: automountToken !== false,
          };
          
          const result = await coreApi.createNamespacedServiceAccount(ns, serviceAccount);
          
          return {
            success: true,
            message: `ServiceAccount ${name} created in namespace ${ns}`,
            serviceAccount: {
              name: result.body.metadata?.name,
              namespace: result.body.metadata?.namespace,
              automountServiceAccountToken: result.body.automountServiceAccountToken,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_serviceaccount", resource: name, namespace };
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
    // Create Role
    {
      tool: {
        name: "k8s_create_role",
        description: "Create a Kubernetes Role (namespaced permissions)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the Role",
            },
            namespace: {
              type: "string",
              description: "Namespace for the Role",
              default: "default",
            },
            rules: {
              type: "array",
              description: "Policy rules defining permissions",
              items: {
                type: "object",
                properties: {
                  apiGroups: { type: "array", items: { type: "string" }, default: [""] },
                  resources: { type: "array", items: { type: "string" } },
                  verbs: { type: "array", items: { type: "string" } },
                  resourceNames: { type: "array", items: { type: "string" } },
                },
              },
            },
            labels: {
              type: "object",
              description: "Labels to apply",
            },
            annotations: {
              type: "object",
              description: "Annotations to apply",
            },
          },
          required: ["name", "rules"],
        },
      },
      handler: async ({ name, namespace, rules, labels, annotations }: { 
        name: string; 
        namespace?: string;
        rules: any[];
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "role");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const ns = namespace || "default";
          
          const role: k8s.V1Role = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "Role",
            metadata: {
              name,
              namespace: ns,
              labels,
              annotations,
            },
            rules: rules.map((r: any) => ({
              apiGroups: r.apiGroups || [""],
              resources: r.resources,
              verbs: r.verbs,
              resourceNames: r.resourceNames,
            })),
          };
          
          const result = await rbacApi.createNamespacedRole(ns, role);
          
          return {
            success: true,
            message: `Role ${name} created in namespace ${ns}`,
            role: {
              name: result.body.metadata?.name,
              namespace: result.body.metadata?.namespace,
              rules: result.body.rules?.length,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_role", resource: name, namespace };
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
    // Create RoleBinding
    {
      tool: {
        name: "k8s_create_rolebinding",
        description: "Create a Kubernetes RoleBinding (binds Role to users/groups/serviceaccounts)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the RoleBinding",
            },
            namespace: {
              type: "string",
              description: "Namespace for the RoleBinding",
              default: "default",
            },
            roleName: {
              type: "string",
              description: "Name of the Role to bind",
            },
            roleKind: {
              type: "string",
              description: "Kind of the role (Role or ClusterRole)",
              enum: ["Role", "ClusterRole"],
              default: "Role",
            },
            subjects: {
              type: "array",
              description: "Subjects to bind (users, groups, or serviceaccounts)",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["User", "Group", "ServiceAccount"] },
                  name: { type: "string" },
                  namespace: { type: "string" },
                  apiGroup: { type: "string" },
                },
              },
            },
            labels: {
              type: "object",
              description: "Labels to apply",
            },
          },
          required: ["name", "roleName", "subjects"],
        },
      },
      handler: async ({ name, namespace, roleName, roleKind, subjects, labels }: { 
        name: string; 
        namespace?: string;
        roleName: string;
        roleKind?: string;
        subjects: any[];
        labels?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "rolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          const ns = namespace || "default";
          
          const roleBinding: k8s.V1RoleBinding = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "RoleBinding",
            metadata: {
              name,
              namespace: ns,
              labels,
            },
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: roleKind || "Role",
              name: roleName,
            },
            subjects: subjects.map((s: any) => ({
              kind: s.kind,
              name: s.name,
              namespace: s.kind === "ServiceAccount" ? (s.namespace || ns) : undefined,
              apiGroup: s.apiGroup || (s.kind === "ServiceAccount" ? "" : "rbac.authorization.k8s.io"),
            })),
          };
          
          const result = await rbacApi.createNamespacedRoleBinding(ns, roleBinding);
          
          return {
            success: true,
            message: `RoleBinding ${name} created in namespace ${ns}`,
            roleBinding: {
              name: result.body.metadata?.name,
              namespace: result.body.metadata?.namespace,
              role: result.body.roleRef?.name,
              subjects: result.body.subjects?.length,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_rolebinding", resource: name, namespace };
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
    // Create ClusterRole
    {
      tool: {
        name: "k8s_create_clusterrole",
        description: "Create a Kubernetes ClusterRole (cluster-wide permissions)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRole",
            },
            rules: {
              type: "array",
              description: "Policy rules defining permissions",
              items: {
                type: "object",
                properties: {
                  apiGroups: { type: "array", items: { type: "string" }, default: [""] },
                  resources: { type: "array", items: { type: "string" } },
                  verbs: { type: "array", items: { type: "string" } },
                  resourceNames: { type: "array", items: { type: "string" } },
                  nonResourceURLs: { type: "array", items: { type: "string" } },
                },
              },
            },
            labels: {
              type: "object",
              description: "Labels to apply",
            },
            annotations: {
              type: "object",
              description: "Annotations to apply",
            },
            aggregationRule: {
              type: "object",
              description: "Aggregation rule for combining cluster roles",
            },
          },
          required: ["name", "rules"],
        },
      },
      handler: async ({ name, rules, labels, annotations }: { 
        name: string; 
        rules: any[];
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "clusterrole");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          
          const clusterRole: k8s.V1ClusterRole = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRole",
            metadata: {
              name,
              labels,
              annotations,
            },
            rules: rules.map((r: any) => ({
              apiGroups: r.apiGroups || [""],
              resources: r.resources,
              verbs: r.verbs,
              resourceNames: r.resourceNames,
              nonResourceURLs: r.nonResourceURLs,
            })),
          };
          
          const result = await rbacApi.createClusterRole(clusterRole);
          
          return {
            success: true,
            message: `ClusterRole ${name} created`,
            clusterRole: {
              name: result.body.metadata?.name,
              rules: result.body.rules?.length,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_clusterrole", resource: name };
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
    // Create ClusterRoleBinding
    {
      tool: {
        name: "k8s_create_clusterrolebinding",
        description: "Create a Kubernetes ClusterRoleBinding (binds ClusterRole to users/groups/serviceaccounts cluster-wide)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the ClusterRoleBinding",
            },
            clusterRoleName: {
              type: "string",
              description: "Name of the ClusterRole to bind",
            },
            subjects: {
              type: "array",
              description: "Subjects to bind (users, groups, or serviceaccounts)",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["User", "Group", "ServiceAccount"] },
                  name: { type: "string" },
                  namespace: { type: "string" },
                  apiGroup: { type: "string" },
                },
              },
            },
            labels: {
              type: "object",
              description: "Labels to apply",
            },
          },
          required: ["name", "clusterRoleName", "subjects"],
        },
      },
      handler: async ({ name, clusterRoleName, subjects, labels }: { 
        name: string; 
        clusterRoleName: string;
        subjects: any[];
        labels?: Record<string, string>;
      }) => {
        try {
          validateResourceName(name, "clusterrolebinding");
          const rbacApi = (k8sClient as any).kc.makeApiClient(k8s.RbacAuthorizationV1Api);
          
          const clusterRoleBinding: k8s.V1ClusterRoleBinding = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRoleBinding",
            metadata: {
              name,
              labels,
            },
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "ClusterRole",
              name: clusterRoleName,
            },
            subjects: subjects.map((s: any) => ({
              kind: s.kind,
              name: s.name,
              namespace: s.kind === "ServiceAccount" ? s.namespace : undefined,
              apiGroup: s.apiGroup || (s.kind === "ServiceAccount" ? "" : "rbac.authorization.k8s.io"),
            })),
          };
          
          const result = await rbacApi.createClusterRoleBinding(clusterRoleBinding);
          
          return {
            success: true,
            message: `ClusterRoleBinding ${name} created`,
            clusterRoleBinding: {
              name: result.body.metadata?.name,
              clusterRole: result.body.roleRef?.name,
              subjects: result.body.subjects?.length,
            },
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_create_clusterrolebinding", resource: name };
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
    // Auth can-i - Check permissions
    {
      tool: {
        name: "k8s_auth_can_i",
        description: "Check if you can perform an action (like kubectl auth can-i)",
        inputSchema: {
          type: "object",
          properties: {
            verb: {
              type: "string",
              description: "Verb to check (create, get, list, delete, update, patch, watch, etc.)",
            },
            resource: {
              type: "string",
              description: "Resource type (pods, deployments, services, etc.)",
            },
            namespace: {
              type: "string",
              description: "Namespace to check in (default: all namespaces for cluster-scoped, or 'default')",
            },
            subresource: {
              type: "string",
              description: "Subresource to check (e.g., 'log', 'exec', 'status')",
            },
            resourceName: {
              type: "string",
              description: "Specific resource name to check",
            },
            asUser: {
              type: "string",
              description: "Check permissions as a different user (requires impersonation rights)",
            },
            asServiceAccount: {
              type: "string",
              description: "Check permissions as a service account (format: namespace/name)",
            },
          },
          required: ["verb", "resource"],
        },
      },
      handler: async ({ verb, resource, namespace, subresource, resourceName, asUser, asServiceAccount }: { 
        verb: string; 
        resource: string;
        namespace?: string;
        subresource?: string;
        resourceName?: string;
        asUser?: string;
        asServiceAccount?: string;
      }) => {
        try {
          const rawClient = k8sClient as any;
          
          // Build the SelfSubjectAccessReview request
          const ssar = {
            apiVersion: "authorization.k8s.io/v1",
            kind: "SelfSubjectAccessReview",
            spec: {
              resourceAttributes: {
                verb,
                resource,
                namespace,
                subresource,
                name: resourceName,
              },
            },
          };
          
          const result = await rawClient.rawApiRequest("/apis/authorization.k8s.io/v1/selfsubjectaccessreviews", { method: "POST", body: ssar });
          
          const allowed = result.status?.allowed || false;
          const reason = result.status?.reason || "";
          
          return {
            success: true,
            allowed,
            verb,
            resource,
            namespace,
            subresource,
            reason: reason || undefined,
            message: allowed 
              ? `yes - you can ${verb} ${subresource ? `${subresource} on ` : ""}${resource}${resourceName ? `/${resourceName}` : ""}${namespace ? ` in namespace ${namespace}` : ""}`
              : `no - you cannot ${verb} ${subresource ? `${subresource} on ` : ""}${resource}${resourceName ? `/${resourceName}` : ""}${namespace ? ` in namespace ${namespace}` : ""}${reason ? ` (${reason})` : ""}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_auth_can_i" };
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
    // List Certificate Signing Requests
    {
      tool: {
        name: "k8s_list_csr",
        description: "List Certificate Signing Requests (CSR)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        try {
          const rawClient = k8sClient as any;
          const result = await rawClient.rawApiRequest("/apis/certificates.k8s.io/v1/certificatesigningrequests");
          
          if (!result || !result.items) {
            return {
              csrs: [],
              total: 0,
            };
          }
          
          return {
            csrs: result.items.map((csr: any) => ({
              name: csr.metadata?.name,
              signerName: csr.spec?.signerName,
              username: csr.spec?.username,
              usages: csr.spec?.usages,
              status: csr.status?.conditions?.find((c: any) => c.type === "Approved") ? "Approved" : 
                      csr.status?.conditions?.find((c: any) => c.type === "Denied") ? "Denied" : "Pending",
              age: csr.metadata?.creationTimestamp,
            })),
            total: result.items.length,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_csr" };
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
    // Approve Certificate Signing Request
    {
      tool: {
        name: "k8s_certificate_approve",
        description: "Approve a Certificate Signing Request (like kubectl certificate approve)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the CSR to approve",
            },
            force: {
              type: "boolean",
              description: "Force approval even if already approved",
              default: false,
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, force }: { name: string; force?: boolean }) => {
        try {
          validateResourceName(name, "certificatesigningrequest");
          const rawClient = k8sClient as any;
          
          // First, check current status
          const csr = await rawClient.rawApiRequest(`/apis/certificates.k8s.io/v1/certificatesigningrequests/${name}`);
          
          const conditions = csr.status?.conditions || [];
          const alreadyApproved = conditions.some((c: any) => c.type === "Approved");
          const alreadyDenied = conditions.some((c: any) => c.type === "Denied");
          
          if (alreadyApproved && !force) {
            return {
              success: true,
              message: `CSR ${name} is already approved`,
              alreadyApproved: true,
            };
          }
          
          if (alreadyDenied && !force) {
            return {
              success: false,
              error: `CSR ${name} is already denied. Use force: true to approve anyway.`,
            };
          }
          
          // Approve the CSR by patching the status
          const patch = {
            status: {
              conditions: [
                ...conditions.filter((c: any) => c.type !== "Approved" && c.type !== "Denied"),
                {
                  type: "Approved",
                  status: "True",
                  reason: "Approved via k8s-mcp-server",
                  message: "This CSR was approved by the MCP server",
                  lastUpdateTime: new Date().toISOString(),
                },
              ],
            },
          };
          
          await rawClient.rawApiRequest(`/apis/certificates.k8s.io/v1/certificatesigningrequests/${name}/approval`, "PUT", {
            ...csr,
            status: patch.status,
          });
          
          return {
            success: true,
            message: `CertificateSigningRequest ${name} approved`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_certificate_approve", resource: name };
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
    // Deny Certificate Signing Request
    {
      tool: {
        name: "k8s_certificate_deny",
        description: "Deny a Certificate Signing Request (like kubectl certificate deny)",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the CSR to deny",
            },
            force: {
              type: "boolean",
              description: "Force denial even if already denied",
              default: false,
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, force }: { name: string; force?: boolean }) => {
        try {
          validateResourceName(name, "certificatesigningrequest");
          const rawClient = k8sClient as any;
          
          // First, check current status
          const csr = await rawClient.rawApiRequest(`/apis/certificates.k8s.io/v1/certificatesigningrequests/${name}`);
          
          const conditions = csr.status?.conditions || [];
          const alreadyDenied = conditions.some((c: any) => c.type === "Denied");
          const alreadyApproved = conditions.some((c: any) => c.type === "Approved");
          
          if (alreadyDenied && !force) {
            return {
              success: true,
              message: `CSR ${name} is already denied`,
              alreadyDenied: true,
            };
          }
          
          if (alreadyApproved && !force) {
            return {
              success: false,
              error: `CSR ${name} is already approved. Use force: true to deny anyway.`,
            };
          }
          
          // Deny the CSR by patching the status
          const patch = {
            status: {
              conditions: [
                ...conditions.filter((c: any) => c.type !== "Approved" && c.type !== "Denied"),
                {
                  type: "Denied",
                  status: "True",
                  reason: "Denied via k8s-mcp-server",
                  message: "This CSR was denied by the MCP server",
                  lastUpdateTime: new Date().toISOString(),
                },
              ],
            },
          };
          
          await rawClient.rawApiRequest(`/apis/certificates.k8s.io/v1/certificatesigningrequests/${name}/approval`, "PUT", {
            ...csr,
            status: patch.status,
          });
          
          return {
            success: true,
            message: `CertificateSigningRequest ${name} denied`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_certificate_deny", resource: name };
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
    // Auth reconcile - Reconcile RBAC resources
    {
      tool: {
        name: "k8s_auth_reconcile",
        description: "Reconciles rules for RBAC Role, ClusterRole, RoleBinding, and ClusterRoleBinding (like kubectl auth reconcile)",
        inputSchema: {
          type: "object",
          properties: {
            manifest: {
              type: "string",
              description: "YAML/JSON manifest containing RBAC resources to reconcile",
            },
            removeExtraSubjects: {
              type: "boolean",
              description: "Remove extra subjects from bindings",
              default: false,
            },
            removeExtraPermissions: {
              type: "boolean",
              description: "Remove extra permissions from roles",
              default: false,
            },
            dryRun: {
              type: "boolean",
              description: "Show what would be changed without making changes",
              default: false,
            },
          },
          required: ["manifest"],
        },
      },
      handler: async ({ manifest, removeExtraSubjects, removeExtraPermissions, dryRun }: { 
        manifest: string;
        removeExtraSubjects?: boolean;
        removeExtraPermissions?: boolean;
        dryRun?: boolean;
      }) => {
        try {
          // Parse manifest to identify RBAC resources
          let resources: any[] = [];
          try {
            // Try to parse as YAML (could be multiple documents)
            const parsed = k8s.loadAllYaml(manifest);
            resources = parsed.filter(r => r && typeof r === 'object');
          } catch (e) {
            try {
              const parsed = JSON.parse(manifest);
              resources = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              return {
                success: false,
                error: "Invalid YAML/JSON manifest",
              };
            }
          }
          
          // Filter RBAC resources
          const rbacResources = resources.filter(r => {
            const kind = r?.kind?.toLowerCase();
            return ['role', 'clusterrole', 'rolebinding', 'clusterrolebinding'].includes(kind);
          });
          
          if (rbacResources.length === 0) {
            return {
              success: false,
              error: "No RBAC resources (Role, ClusterRole, RoleBinding, ClusterRoleBinding) found in manifest",
            };
          }
          
          // Build kubectl command
          let kubectlCommand = `kubectl auth reconcile -f -`;
          if (removeExtraSubjects) kubectlCommand += " --remove-extra-subjects";
          if (removeExtraPermissions) kubectlCommand += " --remove-extra-permissions";
          if (dryRun) kubectlCommand += " --dry-run=client";
          
          // Provide resource summary
          const resourceSummary = rbacResources.map(r => ({
            kind: r.kind,
            name: r.metadata?.name,
            namespace: r.metadata?.namespace,
          }));
          
          return {
            success: true,
            message: `RBAC reconcile prepared for ${rbacResources.length} resource(s)`,
            note: "kubectl auth reconcile reconciles RBAC resources by ensuring the subjects and permissions match exactly what's in the manifest.",
            kubectlCommand,
            kubectlCommandWithFile: `echo '${manifest.replace(/'/g, "'\\''")}' | ${kubectlCommand}`,
            resources: resourceSummary,
            options: {
              removeExtraSubjects: removeExtraSubjects || false,
              removeExtraPermissions: removeExtraPermissions || false,
              dryRun: dryRun || false,
            },
            warning: removeExtraPermissions ? 
              "WARNING: --remove-extra-permissions will remove any permissions not in the manifest!" : undefined,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_auth_reconcile" };
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

function getSecurityIssues(pod: k8s.V1Pod): string[] {
  const issues: string[] = [];
  const spec = pod.spec;
  
  if (spec?.securityContext?.runAsNonRoot) {
    issues.push("Pod runs as root");
  }
  
  const containers = [...(spec?.containers || []), ...(spec?.initContainers || [])];
  for (const c of containers) {
    const sc = c.securityContext;
    if (sc?.privileged) {
      issues.push(`Container ${c.name} is privileged`);
    }
    if (sc?.runAsUser === 0) {
      issues.push(`Container ${c.name} runs as root (UID 0)`);
    }
    if (sc?.allowPrivilegeEscalation === true) {
      issues.push(`Container ${c.name} allows privilege escalation`);
    }
    if (sc?.capabilities?.add?.includes("SYS_ADMIN")) {
      issues.push(`Container ${c.name} has SYS_ADMIN capability`);
    }
    if (sc?.capabilities?.add?.includes("SYS_PTRACE")) {
      issues.push(`Container ${c.name} has SYS_PTRACE capability`);
    }
    if (spec?.serviceAccountName === "default" && spec.automountServiceAccountToken !== false) {
      issues.push("Using default service account with automount");
    }
  }
  
  return issues;
}
