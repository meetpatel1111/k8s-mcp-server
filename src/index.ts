import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "./k8s-client.js";
import { registerClusterTools } from "./k8s-tools/cluster.js";
import { registerNodeTools } from "./k8s-tools/nodes.js";
import { registerPodTools } from "./k8s-tools/pods.js";
import { registerWorkloadTools } from "./k8s-tools/workloads.js";
import { registerNetworkingTools } from "./k8s-tools/networking.js";
import { registerStorageTools } from "./k8s-tools/storage.js";
import { registerSecurityTools } from "./k8s-tools/security.js";
import { registerMonitoringTools } from "./k8s-tools/monitoring.js";
import { registerConfigTools } from "./k8s-tools/config.js";
import { registerAdvancedTools } from "./k8s-tools/advanced.js";
import { registerTemplateTools } from "./k8s-tools/templates.js";
import { registerWebSocketTools } from "./k8s-tools/websocket.js";
import { registerHelmReleaseListTools } from "./helm-tools/release-list.js";
import { registerHelmReleaseStatusTools } from "./helm-tools/release-status.js";
import { registerHelmReleaseHistoryTools } from "./helm-tools/release-history.js";
import { registerHelmReleaseGetValuesTools } from "./helm-tools/release-get-values.js";
import { registerHelmReleaseInstallTools } from "./helm-tools/release-install.js";
import { registerHelmReleaseUninstallTools } from "./helm-tools/release-uninstall.js";
import { registerHelmReleaseUpgradeTools } from "./helm-tools/release-upgrade.js";
import { registerHelmReleaseRollbackTools } from "./helm-tools/release-rollback.js";
import { registerHelmReleaseTestTools } from "./helm-tools/release-test.js";
import { registerHelmReleaseGetInfoTools } from "./helm-tools/release-get-info.js";
import { registerHelmSearchHubTools } from "./helm-tools/search-hub.js";
import { registerHelmRepoManagementTools } from "./helm-tools/repo-management.js";
import { registerHelmShowChartTools } from "./helm-tools/show-chart.js";
import { registerHelmChartManagementTools } from "./helm-tools/chart-management.js";
import { registerHelmChartTemplateTools } from "./helm-tools/chart-template.js";
import { registerHelmDependencyManagementTools } from "./helm-tools/dependency-management.js";
import { registerHelmPluginManagementTools } from "./helm-tools/plugin-management.js";
import { registerHelmRegistryManagementTools } from "./helm-tools/registry-management.js";
import { registerHelmEnvironmentTools } from "./helm-tools/environment.js";
import { registerDiagnosticsTools } from "./k8s-tools/diagnostics.js";
import { classifyError, ErrorContext } from "./error-handling.js";
import { loadConfig, ServerConfig } from "./config.js";
import { CacheManager } from "./cache-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

interface ServerInfo {
  name: string;
  version: string;
  startTime: Date;
  uptime: string;
  toolsCount: number;
  clusterInfo?: any;
  lastHealthCheck?: Date;
  errorCount: number;
  requestCount: number;
  protectionModes?: {
    infrastructure: boolean;
    strict: boolean;
    noDelete: boolean;
    strictBlockedToolCount?: number;
    noDeleteBlockedToolCount?: number;
  };
}

interface ToolMetrics {
  name: string;
  calls: number;
  errors: number;
  avgResponseTime: number;
  lastCalled?: Date;
  lastError?: string;
}


class K8sMcpServer {
  private server: Server;
  private k8sClient: K8sClient;
  private toolRegistry: ToolRegistry;
  private startTime: Date = new Date();
  private isHealthy: boolean = true;
  private lastError?: string;
  private errorCount: number = 0;
  private requestCount: number = 0;
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private lastHealthCheck?: Date;
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerTimer?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly config: ServerConfig;
  private readonly cacheManager: CacheManager;
  // Sliding window for error rate tracking (timestamps of recent errors)
  private recentErrors: number[] = [];
  // Strict Protection Mode - blocks ALL non-read-only operations
  private strictProtectionEnabled: boolean = false;
  // No Delete Protection Mode - blocks only deletion operations
  private noDeleteProtectionEnabled: boolean = false;
  private readonly READ_ONLY_TOOLS = new Set([
    "k8s_list_contexts", "k8s_cluster_version", "k8s_component_status",
    "k8s_cluster_health", "k8s_list_namespaces", "k8s_api_latency_check",
    "k8s_cluster_info", "k8s_version", "k8s_api_versions", "k8s_api_resources",
    "k8s_list_nodes", "k8s_get_node", "k8s_node_pressure_status",
    "k8s_list_pods", "k8s_get_pod", "k8s_describe_pod", "k8s_get_pod_events",
    "k8s_get_logs", "k8s_find_unhealthy_pods", "k8s_find_crashloop_pods",
    "k8s_list_deployments", "k8s_get_deployment", "k8s_deployment_rollout_status",
    "k8s_list_replicasets", "k8s_get_replicaset",
    "k8s_list_statefulsets", "k8s_get_statefulset",
    "k8s_list_daemonsets", "k8s_get_daemonset",
    "k8s_list_jobs", "k8s_get_job", "k8s_list_cronjobs", "k8s_get_cronjob",
    "k8s_list_services", "k8s_get_service", "k8s_get_service_endpoints",
    "k8s_list_ingresses", "k8s_get_ingress", "k8s_list_network_policies",
    "k8s_list_pvs", "k8s_get_pv", "k8s_list_pvcs", "k8s_get_pvc_details",
    "k8s_list_storageclasses", "k8s_get_storageclass",
    "k8s_list_configmaps", "k8s_get_configmap",
    "k8s_list_secrets", "k8s_get_secret",
    "k8s_list_serviceaccounts", "k8s_get_serviceaccount",
    "k8s_list_roles", "k8s_get_role", "k8s_list_clusterroles", "k8s_get_clusterrole",
    "k8s_list_rolebindings", "k8s_get_rolebinding",
    "k8s_list_clusterrolebindings", "k8s_get_clusterrolebinding",
    "k8s_get_rbac_summary", "k8s_list_events", "k8s_get_resource_quotas",
    "k8s_get_limit_ranges", "k8s_health_score", "k8s_get_pod_metrics",
    "k8s_get_node_metrics", "k8s_top_pod", "k8s_top_node",
    "k8s_list_pod_disruption_budgets", "k8s_suggest_optimizations",
    "k8s_list_endpoints", "k8s_list_endpointslice",
    "k8s_list_crd", "k8s_list_custom_resources",
    "k8s_rollout_history", "k8s_explain",
    "k8s_check_privileged_pods", "k8s_auth_can_i",
    "k8s_find_orphaned_resources", "k8s_find_unbound_pvcs",
    "k8s_storage_summary", "k8s_service_topology",
    "k8s_analyze_pod_failure", "k8s_debug_scheduling",
    "k8s_list_hpa", "k8s_get_hpa",
    "k8s_watch", "k8s_config_set", "k8s_config_unset",
    "k8s_pod_log_search",
    // Helm read-only tools
    "k8s_helm_list", "k8s_helm_status", "k8s_helm_history",
    "k8s_helm_get_manifest", "k8s_helm_get_notes", "k8s_helm_get_hooks",
    "k8s_helm_get_all", "k8s_helm_get_metadata", "k8s_helm_values",
    "k8s_helm_repo_list", "k8s_helm_search", "k8s_helm_show",
    "k8s_helm_template", "k8s_helm_env", "k8s_helm_version",
    "k8s_helm_plugin_list", "k8s_helm_verify", "k8s_helm_lint",
    // Server tools
    "mcp_server_info", "mcp_health_check", "mcp_tool_metrics",
    "k8s_toggle_protection_mode", "k8s_toggle_strict_protection_mode", "k8s_toggle_no_delete_mode",
    "k8s_toggle_all_protection_modes",
  ]);
  // Per-tool timeout overrides (ms)
  private readonly TOOL_TIMEOUTS: Record<string, number> = {
    "k8s_cluster_info_dump": 120000,
    "k8s_health_score": 60000,
    "k8s_analyze_pod_failure": 60000,
    "k8s_suggest_optimizations": 60000,
    "k8s_debug_scheduling": 45000,
    "k8s_service_topology": 45000,
    "k8s_find_orphaned_resources": 60000,
    "k8s_helm_list": 30000,
    "k8s_helm_status": 30000,
    "k8s_namespace_summary": 60000,
    "k8s_resource_age_report": 60000,
  };
  
  // Infrastructure Protection Mode
  private infraProtectionEnabled: boolean = true; // Enabled by default for safety
  private readonly DESTRUCTIVE_TOOLS = new Set([
    // Deletion operations
    "k8s_delete_pod",
    "k8s_bulk_delete_pods",
    "k8s_delete",
    "k8s_delete_namespace",
    "k8s_delete_deployment",
    "k8s_delete_statefulset",
    "k8s_delete_daemonset",
    "k8s_delete_replicaset",
    "k8s_delete_job",
    "k8s_delete_cronjob",
    "k8s_delete_service",
    "k8s_delete_ingress",
    "k8s_delete_configmap",
    "k8s_delete_secret",
    "k8s_delete_pvc",
    "k8s_delete_serviceaccount",
    "k8s_delete_role",
    "k8s_delete_clusterrole",
    "k8s_delete_rolebinding",
    "k8s_delete_clusterrolebinding",
    "k8s_delete_hpa",
    // Node operations that affect scheduling
    "k8s_drain_node",
    "k8s_cordon_node",
    "k8s_uncordon_node",
    "k8s_add_node_taint",
    "k8s_remove_node_taint",
    // Scaling operations that could cause issues
    "k8s_scale_deployment",
    "k8s_scale",
    "k8s_autoscale",
    // Resource modifications
    "k8s_patch",
    "k8s_label",
    "k8s_annotate",
    "k8s_set_image",
    "k8s_edit",
    // Rollout operations
    "k8s_restart_deployment",
    "k8s_rollback_deployment",
    "k8s_rollout_undo",
    "k8s_rollout_pause",
    "k8s_rollout_resume",
    "k8s_restart_statefulset",
    "k8s_restart_daemonset",
    // Creation operations that could be risky
    "k8s_apply_manifest",
    "k8s_create_deployment",
    "k8s_create_job",
    "k8s_create_cronjob",
    "k8s_create_service",
    "k8s_create_ingress",
    "k8s_create_networkpolicy",
    "k8s_create_configmap",
    "k8s_create_secret",
    "k8s_create_serviceaccount",
    "k8s_create_role",
    "k8s_create_rolebinding",
    "k8s_create_clusterrole",
    "k8s_create_clusterrolebinding",
    "k8s_create_resource_quota",
    "k8s_create_limit_range",
    "k8s_expose",
    "k8s_run",
    "k8s_quick_deploy",
    // Helm destructive operations
    "k8s_helm_install",
    "k8s_helm_upgrade",
    "k8s_helm_uninstall",
    "k8s_helm_rollback",
    "k8s_helm_test",
    "k8s_helm_create",
    "k8s_helm_package",
    "k8s_helm_push",
    "k8s_helm_repo_add",
    "k8s_helm_repo_remove",
    "k8s_helm_repo_update",
    "k8s_helm_repo_index",
    "k8s_helm_dependency",
    "k8s_helm_plugin_install",
    "k8s_helm_plugin_uninstall",
    "k8s_helm_plugin_update",
    "k8s_helm_plugin_package",
    "k8s_helm_registry_login",
    "k8s_helm_registry_logout",
    "k8s_helm_pull",
  ]);

  // No Delete Protection Mode - only blocks deletion operations
  private readonly DELETION_TOOLS = new Set([
    // Kubernetes resource deletions
    "k8s_delete_pod",
    "k8s_bulk_delete_pods",
    "k8s_delete",
    "k8s_delete_namespace",
    "k8s_delete_deployment",
    "k8s_delete_statefulset",
    "k8s_delete_daemonset",
    "k8s_delete_replicaset",
    "k8s_delete_job",
    "k8s_delete_cronjob",
    "k8s_delete_service",
    "k8s_delete_ingress",
    "k8s_delete_configmap",
    "k8s_delete_secret",
    "k8s_delete_pvc",
    "k8s_delete_serviceaccount",
    "k8s_delete_role",
    "k8s_delete_clusterrole",
    "k8s_delete_rolebinding",
    "k8s_delete_clusterrolebinding",
    "k8s_delete_hpa",
    "k8s_delete_networkpolicy",
    "k8s_delete_resourcequota",
    "k8s_delete_limitrange",
    "k8s_delete_storageclass",
    "k8s_delete_pv",
    "k8s_delete_pdb",
    "k8s_delete_runtimeclass",
    "k8s_delete_lease",
    "k8s_delete_csr",
    "k8s_delete_ingressclass",
    // Helm deletions
    "k8s_helm_uninstall",
    "k8s_helm_plugin_uninstall",
  ]);

  constructor() {
    // Load configuration
    this.config = loadConfig();
    this.infraProtectionEnabled = this.config.infraProtectionEnabled;
    this.strictProtectionEnabled = this.config.strictProtectionEnabled;
    this.noDeleteProtectionEnabled = this.config.noDeleteProtectionEnabled;

    // Initialize cache manager
    this.cacheManager = new CacheManager(this.config.cacheDefaultTtl);

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();

    this.setupGracefulShutdown();

    console.error(`Infrastructure Protection Mode: ${this.infraProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    if (this.infraProtectionEnabled) {
      console.error(`Destructive tools are blocked. Use k8s_toggle_protection_mode to disable.`);
    }
    console.error(`Strict Protection Mode: ${this.strictProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    if (this.strictProtectionEnabled) {
      console.error(`ALL modification operations are blocked. Only read-only tools are available.`);
    }
    console.error(`No Delete Protection Mode: ${this.noDeleteProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    if (this.noDeleteProtectionEnabled) {
      console.error(`Delete operations are blocked. Updates and modifications are still allowed.`);
    }

    try {
      this.k8sClient = new K8sClient();
    } catch (error) {
      console.error("Failed to initialize K8sClient:", error);
      throw new Error(`Kubernetes client initialization failed: ${error}`);
    }
    
    this.server = new Server(
      {
        name: "k8s-mcp-server",
        version: packageJson.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupHealthCheck();
    this.setupErrorHandling();
  }


  private setupHandlers(): void {
    try {
      // Register all tool categories
      this.registerTools(registerClusterTools(this.k8sClient));
      this.registerTools(registerNodeTools(this.k8sClient));
      this.registerTools(registerPodTools(this.k8sClient));
      this.registerTools(registerWorkloadTools(this.k8sClient));
      this.registerTools(registerNetworkingTools(this.k8sClient));
      this.registerTools(registerStorageTools(this.k8sClient));
      this.registerTools(registerSecurityTools(this.k8sClient));
      this.registerTools(registerMonitoringTools(this.k8sClient));
      this.registerTools(registerConfigTools(this.k8sClient));
      this.registerTools(registerAdvancedTools(this.k8sClient));
      this.registerTools(registerTemplateTools(this.k8sClient));
      this.registerTools(registerWebSocketTools(this.k8sClient));
      this.registerTools(registerHelmReleaseListTools(this.k8sClient));
      this.registerTools(registerHelmReleaseStatusTools(this.k8sClient));
      this.registerTools(registerHelmReleaseHistoryTools(this.k8sClient));
      this.registerTools(registerHelmReleaseGetValuesTools(this.k8sClient));
      this.registerTools(registerHelmReleaseInstallTools(this.k8sClient));
      this.registerTools(registerHelmReleaseUninstallTools(this.k8sClient));
      this.registerTools(registerHelmReleaseUpgradeTools(this.k8sClient));
      this.registerTools(registerHelmReleaseRollbackTools(this.k8sClient));
      this.registerTools(registerHelmReleaseTestTools(this.k8sClient));
      this.registerTools(registerHelmReleaseGetInfoTools(this.k8sClient));
      this.registerTools(registerHelmSearchHubTools(this.k8sClient));
      this.registerTools(registerHelmRepoManagementTools(this.k8sClient));
      this.registerTools(registerHelmShowChartTools(this.k8sClient));
      this.registerTools(registerHelmChartManagementTools(this.k8sClient));
      this.registerTools(registerHelmChartTemplateTools(this.k8sClient));
      this.registerTools(registerHelmDependencyManagementTools(this.k8sClient));
      this.registerTools(registerHelmPluginManagementTools(this.k8sClient));
      this.registerTools(registerHelmRegistryManagementTools(this.k8sClient));
      this.registerTools(registerHelmEnvironmentTools(this.k8sClient));
      this.registerTools(registerDiagnosticsTools(this.k8sClient));

      // Register server management tools
      this.registerServerTools();

      console.error(`Registered ${this.toolRegistry.size()} tools successfully`);
    } catch (error) {
      console.error("Failed to register tools:", error);
      throw new Error(`Tool registration failed: ${error}`);
    }

    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return {
          tools: Array.from(this.toolRegistry.getAllTools().values()),
        };
      } catch (error) {
        console.error("Failed to list tools:", error);
        throw new McpError(ErrorCode.InternalError, "Failed to retrieve tools list");
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      this.requestCount++;

      const { name, arguments: args } = request.params;
      const handler = this.toolRegistry.getHandler(name);

      if (!handler) {
        const error = `Unknown tool: ${name}`;
        this.updateToolMetrics(name, startTime, false, error);
        throw new McpError(ErrorCode.MethodNotFound, error);
      }

      // Check circuit breaker - block requests when error rate is too high
      if (this.circuitBreakerOpen) {
        const error = `Circuit breaker is OPEN due to high error rate. Requests temporarily blocked. ` +
          `Auto-resets in up to ${this.config.circuitBreakerTimeout / 1000}s. Wait and retry.`;
        this.updateToolMetrics(name, startTime, false, error);
        throw new McpError(ErrorCode.InternalError, error);
      }

      // Check infrastructure protection mode for destructive tools
      if (this.infraProtectionEnabled && this.DESTRUCTIVE_TOOLS.has(name)) {
        const error = `Tool '${name}' is blocked by Infrastructure Protection Mode. ` +
          `This is a destructive operation that could impact cluster stability. ` +
          `To enable destructive tools, use 'k8s_toggle_protection_mode' or set INFRA_PROTECTION_MODE=false`;
        this.updateToolMetrics(name, startTime, false, error);
        throw new McpError(ErrorCode.InternalError, error);
      }

      // Check strict protection mode - blocks ALL non-read-only operations
      if (this.strictProtectionEnabled && !this.READ_ONLY_TOOLS.has(name)) {
        const error = `Tool '${name}' is blocked by Strict Protection Mode. ` +
          `Only read-only/list operations are allowed. ` +
          `This tool would modify cluster state. ` +
          `To disable strict protection, use 'k8s_toggle_strict_protection_mode' or set STRICT_PROTECTION_MODE=false`;
        this.updateToolMetrics(name, startTime, false, error);
        throw new McpError(ErrorCode.InternalError, error);
      }

      // Check no delete protection mode - blocks only deletion operations
      if (this.noDeleteProtectionEnabled && this.DELETION_TOOLS.has(name)) {
        const error = `Tool '${name}' is blocked by No Delete Protection Mode. ` +
          `Delete operations are not allowed. ` +
          `You can still update, scale, and modify resources. ` +
          `To disable no-delete protection, use 'k8s_toggle_no_delete_mode' or set NO_DELETE_PROTECTION_MODE=false`;
        this.updateToolMetrics(name, startTime, false, error);
        throw new McpError(ErrorCode.InternalError, error);
      }

      // Validate arguments
      const tool = this.toolRegistry.getTool(name);
      if (tool && tool.inputSchema) {
        const validationError = this.validateArguments(tool.inputSchema, args);
        if (validationError) {
          this.updateToolMetrics(name, startTime, false, validationError);
          throw new McpError(ErrorCode.InvalidParams, validationError);
        }
      }

      // Check cache for read-only operations
      if (this.READ_ONLY_TOOLS.has(name)) {
        const cacheKey = `${name}:${JSON.stringify(args || {})}`;
        const cached = this.cacheManager.get(cacheKey);
        if (cached !== undefined) {
          const responseTime = Date.now() - startTime;
          this.updateToolMetrics(name, startTime, true);
          return {
            content: [{ type: "text", text: typeof cached === "string" ? cached : JSON.stringify(cached, null, 2) }],
            _meta: { executionTime: responseTime, toolName: name, cached: true },
          };
        }
      }

      // Get per-tool timeout
      const timeout = this.TOOL_TIMEOUTS[name] || this.config.defaultToolTimeout;

      try {
        const result = await Promise.race([
          handler(args),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout / 1000}s`)), timeout)
          )
        ]);

        const responseTime = Date.now() - startTime;
        this.updateToolMetrics(name, startTime, true);

        // Cache read-only results
        if (this.READ_ONLY_TOOLS.has(name)) {
          const cacheKey = `${name}:${JSON.stringify(args || {})}`;
          this.cacheManager.set(cacheKey, result);
        }

        return {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
          _meta: {
            executionTime: responseTime,
            toolName: name,
          },
        };
      } catch (error) {
        const argsAny = args as any;
        const context: ErrorContext = { operation: name, resource: argsAny?.name, namespace: argsAny?.namespace };
        const classifiedError = classifyError(error, context);

        this.lastError = classifiedError.message;
        this.errorCount++;
        this.trackError();
        this.updateToolMetrics(name, startTime, false, classifiedError.message);

        // Check sliding window error rate for circuit breaker
        if (this.getRecentErrorCount() >= this.config.maxErrorsPerMinute) {
          this.openCircuitBreaker();
        }

        // Create detailed error response
        const errorResponse = {
          error: classifiedError.message,
          type: classifiedError.type,
          suggestions: classifiedError.suggestions,
          operation: name,
          ...(classifiedError.context.resource && { resource: classifiedError.context.resource }),
          ...(classifiedError.context.namespace && { namespace: classifiedError.context.namespace }),
          ...(classifiedError.details && { details: classifiedError.details }),
        };

        throw new McpError(
          ErrorCode.InternalError,
          JSON.stringify(errorResponse, null, 2)
        );
      }
    });
  }

  private registerTools(tools: { tool: Tool; handler: Function }[]): void {
    this.toolRegistry.registerMany(tools);
  }

  private registerServerTools(): void {
    // Server info tool
    this.registerTools([{
      tool: {
        name: "mcp_server_info",
        description: "Get comprehensive MCP server information and status",
        inputSchema: {
          type: "object",
          properties: {
            includeMetrics: {
              type: "boolean",
              description: "Include detailed tool metrics",
              default: false,
            },
          },
        },
      },
      handler: async ({ includeMetrics }: { includeMetrics?: boolean }) => {
        const uptime = this.getUptime();
        const blockedCount = this.strictProtectionEnabled
          ? Array.from(this.toolRegistry.getAllTools().keys()).filter(name => !this.READ_ONLY_TOOLS.has(name)).length
          : 0;
        const info: ServerInfo = {
          name: "k8s-mcp-server",
          version: packageJson.version,
          startTime: this.startTime,
          uptime,
          toolsCount: this.toolRegistry.size(),
          lastHealthCheck: this.lastHealthCheck,
          errorCount: this.errorCount,
          requestCount: this.requestCount,
          protectionModes: {
            infrastructure: this.infraProtectionEnabled,
            strict: this.strictProtectionEnabled,
            noDelete: this.noDeleteProtectionEnabled,
            strictBlockedToolCount: blockedCount > 0 ? blockedCount : undefined,
            noDeleteBlockedToolCount: this.noDeleteProtectionEnabled ? this.DELETION_TOOLS.size : undefined,
          },
        };
        
        try {
          info.clusterInfo = await this.k8sClient.getClusterVersion();
        } catch (error) {
          info.clusterInfo = { 
            error: "Unable to connect to cluster",
            details: error instanceof Error ? error.message : String(error)
          };
        }
        
        if (includeMetrics) {
          const metrics = Array.from(this.toolMetrics.entries()).map(([toolName, metric]) => ({
            toolName,
            ...metric,
          }));
          return { ...info, metrics };
        }
        
        return info;
      },
    }]);

    // Enhanced health check
    this.registerTools([{
      tool: {
        name: "mcp_health_check",
        description: "Comprehensive health check with diagnostics",
        inputSchema: {
          type: "object",
          properties: {
            deep: {
              type: "boolean",
              description: "Perform deep health check including cluster connectivity",
              default: false,
            },
            timeout: {
              type: "number",
              description: "Health check timeout in seconds",
              default: 10,
            },
          },
        },
      },
      handler: async ({ deep, timeout }: { deep?: boolean; timeout?: number }) => {
        const blockedCount = this.strictProtectionEnabled
          ? Array.from(this.toolRegistry.getAllTools().keys()).filter(name => !this.READ_ONLY_TOOLS.has(name)).length
          : 0;
        const health = {
          server: {
            healthy: this.isHealthy,
            uptime: this.getUptime(),
            lastError: this.lastError,
            errorCount: this.errorCount,
            requestCount: this.requestCount,
            circuitBreakerOpen: this.circuitBreakerOpen,
          },
          protection: {
            infrastructure: this.infraProtectionEnabled,
            strict: this.strictProtectionEnabled,
            noDelete: this.noDeleteProtectionEnabled,
            strictBlockedToolCount: blockedCount > 0 ? blockedCount : undefined,
            noDeleteBlockedToolCount: this.noDeleteProtectionEnabled ? this.DELETION_TOOLS.size : undefined,
            readOnlyToolCount: this.READ_ONLY_TOOLS.size,
          },
          cluster: {
            connected: false,
            version: null as any,
            nodes: 0,
            namespaces: 0,
            responseTime: null as number | null,
            error: null as string | null,
          },
          tools: {
            total: this.toolRegistry.size(),
            registered: this.toolRegistry.size(),
            withErrors: Array.from(this.toolMetrics.entries())
              .filter(([, metric]) => metric.errors > 0)
              .map(([name]) => name),
          },
        };

        if (deep) {
          try {
            const startTime = Date.now();
            
            // Test cluster connectivity with timeout
            const version = await Promise.race([
              this.k8sClient.getClusterVersion(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Health check timeout")), (timeout || 10) * 1000)
              )
            ]);
            
            health.cluster.connected = true;
            health.cluster.version = version;
            health.cluster.responseTime = Date.now() - startTime;
            
            // Get basic cluster stats
            const [nodes, namespaces] = await Promise.all([
              this.k8sClient.listNodes().catch(() => []),
              this.k8sClient.listNamespaces().catch(() => []),
            ]);
            health.cluster.nodes = nodes.length;
            health.cluster.namespaces = namespaces.length;
            
          } catch (error) {
            health.cluster.connected = false;
            health.cluster.error = error instanceof Error ? error.message : String(error);
          }
        }

        return health;
      },
    }]);

    // Tool metrics
    this.registerTools([{
      tool: {
        name: "mcp_tool_metrics",
        description: "Get detailed tool usage metrics",
        inputSchema: {
          type: "object",
          properties: {
            tool: {
              type: "string",
              description: "Specific tool name (optional, shows all if not specified)",
            },
            sortBy: {
              type: "string",
              description: "Sort metrics by field",
              enum: ["calls", "errors", "avgResponseTime"],
              default: "calls",
            },
          },
        },
      },
      handler: async ({ tool, sortBy }: { tool?: string; sortBy?: string }) => {
        let metrics = Array.from(this.toolMetrics.entries()).map(([toolName, metric]) => ({
          toolName,
          ...metric,
        }));
        
        if (tool) {
          metrics = metrics.filter(m => m.toolName === tool);
        }
        
        metrics.sort((a, b) => {
          const field = sortBy || "calls";
          return (b[field as keyof ToolMetrics] as number) - (a[field as keyof ToolMetrics] as number);
        });
        
        return {
          metrics,
          summary: {
            totalTools: this.toolRegistry.size(),
            toolsWithMetrics: metrics.length,
            totalCalls: metrics.reduce((sum, m) => sum + m.calls, 0),
            totalErrors: metrics.reduce((sum, m) => sum + m.errors, 0),
          },
        };
      },
    }]);

    // Infrastructure Protection Mode toggle
    this.registerTools([{
      tool: {
        name: "k8s_toggle_protection_mode",
        description: "Toggle Infrastructure Protection Mode. When enabled (default), destructive tools that could break cluster infrastructure are blocked. When disabled, all tools are available. Use with caution.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          return {
            protectionMode: this.infraProtectionEnabled ? "enabled" : "disabled",
            destructiveToolsBlocked: this.infraProtectionEnabled ? Array.from(this.DESTRUCTIVE_TOOLS) : [],
            destructiveToolsCount: this.DESTRUCTIVE_TOOLS.size,
            message: this.infraProtectionEnabled 
              ? "Infrastructure Protection Mode is ENABLED. Destructive tools are blocked."
              : "Infrastructure Protection Mode is DISABLED. All tools are available - use with caution!",
          };
        }
        
        // Trying to disable protection
        if (!enabled) {
          if (!confirm) {
            return {
              success: false,
              protectionMode: "enabled",
              warning: "⚠️  DISABLING INFRASTRUCTURE PROTECTION IS DANGEROUS",
              message: "To disable protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, destructive operations like delete, drain, scale-down, and resource modifications will be allowed.",
              destructiveToolsCount: this.DESTRUCTIVE_TOOLS.size,
              destructiveTools: Array.from(this.DESTRUCTIVE_TOOLS),
            };
          }
          
          this.infraProtectionEnabled = false;
          console.error("⚠️  INFRASTRUCTURE PROTECTION MODE DISABLED - Destructive tools are now available");
          
          return {
            success: true,
            protectionMode: "disabled",
            warning: "⚠️  Infrastructure Protection Mode is now DISABLED",
            message: "Destructive tools are now available. Use with extreme caution!",
            destructiveToolsNowAvailable: Array.from(this.DESTRUCTIVE_TOOLS),
          };
        }
        
        // Enabling protection
        this.infraProtectionEnabled = true;
        console.error("Infrastructure Protection Mode ENABLED - Destructive tools are now blocked");

        return {
          success: true,
          protectionMode: "enabled",
          message: "Infrastructure Protection Mode is now ENABLED. Destructive tools are blocked.",
          destructiveToolsBlocked: Array.from(this.DESTRUCTIVE_TOOLS),
        };
      },
    }]);

    // Strict Protection Mode toggle - blocks ALL non-read-only operations
    this.registerTools([{
      tool: {
        name: "k8s_toggle_strict_protection_mode",
        description: "Toggle Strict Protection Mode. When enabled, ALL non-read-only tools are blocked - only list, get, describe, and monitoring operations are allowed. This is the highest level of protection for production clusters where no modifications should ever be made. Use with caution.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) strict protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling strict protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          const blockedTools = Array.from(this.toolRegistry.getAllTools().keys())
            .filter(name => !this.READ_ONLY_TOOLS.has(name));
          return {
            strictProtectionMode: this.strictProtectionEnabled ? "enabled" : "disabled",
            readOnlyToolsCount: this.READ_ONLY_TOOLS.size,
            blockedToolsCount: blockedTools.length,
            message: this.strictProtectionEnabled
              ? "Strict Protection Mode is ENABLED. Only read-only/list operations are allowed."
              : "Strict Protection Mode is DISABLED. All tools are available - use with caution!",
          };
        }

        // Trying to disable strict protection
        if (!enabled) {
          if (!confirm) {
            const blockedTools = Array.from(this.toolRegistry.getAllTools().keys())
              .filter(name => !this.READ_ONLY_TOOLS.has(name));
            return {
              success: false,
              strictProtectionMode: "enabled",
              warning: "⚠️  DISABLING STRICT PROTECTION IS EXTREMELY DANGEROUS FOR PRODUCTION",
              message: "To disable strict protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, ALL modification operations including create, update, delete, scale, restart, and resource changes will be allowed.",
              blockedToolsCount: blockedTools.length,
              blockedToolCategories: [
                "Create operations (deployments, services, configmaps, secrets, etc.)",
                "Update operations (scaling, image updates, patching, labeling)",
                "Delete operations (pods, deployments, namespaces, etc.)",
                "Helm operations (install, upgrade, uninstall, rollback)",
                "Node operations (drain, cordon, taints)",
                "Resource modifications (rollouts, restarts, autoscaling)",
              ],
            };
          }

          this.strictProtectionEnabled = false;
          console.error("⚠️  STRICT PROTECTION MODE DISABLED - All modification tools are now available");

          return {
            success: true,
            strictProtectionMode: "disabled",
            warning: "⚠️  Strict Protection Mode is now DISABLED",
            message: "All modification tools are now available. Use with extreme caution!",
          };
        }

        // Enabling strict protection
        this.strictProtectionEnabled = true;
        const blockedTools = Array.from(this.toolRegistry.getAllTools().keys())
          .filter(name => !this.READ_ONLY_TOOLS.has(name));
        console.error("STRICT PROTECTION MODE ENABLED - Only read-only tools are now available");

        return {
          success: true,
          strictProtectionMode: "enabled",
          message: "Strict Protection Mode is now ENABLED. Only read-only/list operations are allowed.",
          readOnlyToolsAvailable: this.READ_ONLY_TOOLS.size,
          blockedToolsCount: blockedTools.length,
          note: "This is the highest level of protection. No modifications to the cluster are possible.",
          allowedOperations: [
            "List resources (pods, deployments, nodes, services, etc.)",
            "Get resource details and describe operations",
            "View logs and events",
            "Check health, metrics, and status",
            "Export and view configurations",
          ],
          blockedOperations: [
            "Create, update, or delete any resources",
            "Scale deployments or enable autoscaling",
            "Drain, cordon, or modify nodes",
            "Install, upgrade, or uninstall Helm charts",
            "Apply manifests or run pods",
            "Restart deployments or perform rollouts",
          ],
        };
      },
    }]);

    // No Delete Protection Mode toggle - blocks only deletion operations
    this.registerTools([{
      tool: {
        name: "k8s_toggle_no_delete_mode",
        description: "Toggle No Delete Protection Mode. When enabled, only delete operations are blocked - you can still update, scale, modify, and create resources. This is useful for environments where resource modifications are needed but accidental deletions must be prevented.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable (true) or disable (false) no-delete protection mode. If not specified, returns current status.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling no-delete protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ enabled, confirm }: { enabled?: boolean; confirm?: boolean }) => {
        // If no enabled param, return current status
        if (enabled === undefined) {
          return {
            noDeleteProtectionMode: this.noDeleteProtectionEnabled ? "enabled" : "disabled",
            deleteToolsBlocked: this.DELETION_TOOLS.size,
            message: this.noDeleteProtectionEnabled
              ? "No Delete Protection Mode is ENABLED. Delete operations are blocked, but updates and modifications are allowed."
              : "No Delete Protection Mode is DISABLED. All operations including deletes are available.",
            blockedDeleteOperations: this.noDeleteProtectionEnabled ? Array.from(this.DELETION_TOOLS) : [],
          };
        }

        // Trying to disable no-delete protection
        if (!enabled) {
          if (!confirm) {
            return {
              success: false,
              noDeleteProtectionMode: "enabled",
              warning: "⚠️  DISABLING NO-DELETE PROTECTION WILL ALLOW DELETION OF RESOURCES",
              message: "To disable no-delete protection mode, you must set 'confirm: true' to acknowledge the risk.",
              note: "When disabled, delete operations including pod deletion, namespace deletion, resource cleanup, and Helm uninstall will be allowed.",
              deleteToolsCount: this.DELETION_TOOLS.size,
              blockedDeleteOperations: Array.from(this.DELETION_TOOLS),
            };
          }

          this.noDeleteProtectionEnabled = false;
          console.error("⚠️  NO DELETE PROTECTION MODE DISABLED - Delete operations are now available");

          return {
            success: true,
            noDeleteProtectionMode: "disabled",
            warning: "⚠️  No Delete Protection Mode is now DISABLED",
            message: "Delete operations are now available. Deletions of resources, namespaces, and Helm releases are now allowed.",
          };
        }

        // Enabling no-delete protection
        this.noDeleteProtectionEnabled = true;
        console.error("NO DELETE PROTECTION MODE ENABLED - Delete operations are now blocked");

        return {
          success: true,
          noDeleteProtectionMode: "enabled",
          message: "No Delete Protection Mode is now ENABLED. Delete operations are blocked, but updates and modifications are still allowed.",
          deleteToolsBlocked: this.DELETION_TOOLS.size,
          note: "You can still create, update, scale, patch, and modify resources. Only delete and uninstall operations are blocked.",
          allowedOperations: [
            "Create resources (deployments, services, configmaps, secrets, etc.)",
            "Update resources (scaling, image updates, patching, labeling)",
            "Modify resource configurations",
            "Install and upgrade Helm charts",
            "Run new pods and jobs",
            "Apply manifests",
            "Restart and rollout deployments",
          ],
          blockedOperations: [
            "Delete pods, deployments, namespaces, or any resources",
            "Uninstall Helm releases",
            "Bulk delete operations",
            "Uninstall Helm plugins",
          ],
        };
      },
    }]);

    // Master toggle for all protection modes
    this.registerTools([{
      tool: {
        name: "k8s_toggle_all_protection_modes",
        description: "Master toggle to control all protection modes at once. This allows you to enable or disable Infrastructure Protection, Strict Protection, and No Delete Protection modes simultaneously. Useful for quickly switching between full access and fully protected states.",
        inputSchema: {
          type: "object",
          properties: {
            infrastructure: {
              type: "boolean",
              description: "Enable (true) or disable (false) Infrastructure Protection Mode. If not specified, keeps current state.",
            },
            strict: {
              type: "boolean",
              description: "Enable (true) or disable (false) Strict Protection Mode. If not specified, keeps current state.",
            },
            noDelete: {
              type: "boolean",
              description: "Enable (true) or disable (false) No Delete Protection Mode. If not specified, keeps current state.",
            },
            confirm: {
              type: "boolean",
              description: "Required confirmation when disabling any protection mode (set to true to acknowledge risk)",
              default: false,
            },
          },
        },
      },
      handler: async ({ infrastructure, strict, noDelete, confirm }: { infrastructure?: boolean; strict?: boolean; noDelete?: boolean; confirm?: boolean }) => {
        // If no params provided, return current status of all modes
        if (infrastructure === undefined && strict === undefined && noDelete === undefined) {
          return {
            protectionModes: {
              infrastructure: {
                enabled: this.infraProtectionEnabled,
                description: "Blocks destructive operations (delete, risky creates)",
                toolCount: this.DESTRUCTIVE_TOOLS.size,
              },
              strict: {
                enabled: this.strictProtectionEnabled,
                description: "Blocks ALL non-read-only operations (read-only mode)",
                readOnlyToolCount: this.READ_ONLY_TOOLS.size,
              },
              noDelete: {
                enabled: this.noDeleteProtectionEnabled,
                description: "Blocks only deletion operations (updates allowed)",
                deleteToolCount: this.DELETION_TOOLS.size,
              },
            },
            summary: {
              totalProtected: (this.infraProtectionEnabled ? 1 : 0) + (this.strictProtectionEnabled ? 1 : 0) + (this.noDeleteProtectionEnabled ? 1 : 0),
              mostRestrictiveActive: this.strictProtectionEnabled ? "strict" : this.infraProtectionEnabled ? "infrastructure" : this.noDeleteProtectionEnabled ? "noDelete" : "none",
            },
          };
        }

        // Check if trying to disable any protection without confirmation
        const disablingInfra = infrastructure === false && this.infraProtectionEnabled;
        const disablingStrict = strict === false && this.strictProtectionEnabled;
        const disablingNoDelete = noDelete === false && this.noDeleteProtectionEnabled;

        if ((disablingInfra || disablingStrict || disablingNoDelete) && !confirm) {
          const modesBeingDisabled: string[] = [];
          if (disablingInfra) modesBeingDisabled.push("Infrastructure Protection");
          if (disablingStrict) modesBeingDisabled.push("Strict Protection");
          if (disablingNoDelete) modesBeingDisabled.push("No Delete Protection");

          return {
            success: false,
            warning: `⚠️  DISABLING PROTECTION MODES: ${modesBeingDisabled.join(", ")}`,
            message: "To disable protection modes, you must set 'confirm: true' to acknowledge the risk.",
            currentStates: {
              infrastructure: this.infraProtectionEnabled,
              strict: this.strictProtectionEnabled,
              noDelete: this.noDeleteProtectionEnabled,
            },
          };
        }

        // Track what changed
        const changes: string[] = [];

        // Apply Infrastructure Protection change
        if (infrastructure !== undefined && infrastructure !== this.infraProtectionEnabled) {
          this.infraProtectionEnabled = infrastructure;
          changes.push(infrastructure ? "Infrastructure Protection ENABLED" : "Infrastructure Protection DISABLED");
          console.error(infrastructure ? "Infrastructure Protection Mode ENABLED - Destructive tools are now blocked" : "⚠️  INFRASTRUCTURE PROTECTION MODE DISABLED");
        }

        // Apply Strict Protection change
        if (strict !== undefined && strict !== this.strictProtectionEnabled) {
          this.strictProtectionEnabled = strict;
          changes.push(strict ? "Strict Protection ENABLED" : "Strict Protection DISABLED");
          console.error(strict ? "STRICT PROTECTION MODE ENABLED - Only read-only tools are now available" : "⚠️  STRICT PROTECTION MODE DISABLED");
        }

        // Apply No Delete Protection change
        if (noDelete !== undefined && noDelete !== this.noDeleteProtectionEnabled) {
          this.noDeleteProtectionEnabled = noDelete;
          changes.push(noDelete ? "No Delete Protection ENABLED" : "No Delete Protection DISABLED");
          console.error(noDelete ? "NO DELETE PROTECTION MODE ENABLED - Delete operations are now blocked" : "⚠️  NO DELETE PROTECTION MODE DISABLED");
        }

        // If nothing changed
        if (changes.length === 0) {
          return {
            success: true,
            changed: false,
            message: "No protection modes were changed (requested states match current states).",
            currentStates: {
              infrastructure: this.infraProtectionEnabled,
              strict: this.strictProtectionEnabled,
              noDelete: this.noDeleteProtectionEnabled,
            },
          };
        }

        return {
          success: true,
          changed: true,
          changes,
          message: `Protection modes updated: ${changes.join(", ")}`,
          currentStates: {
            infrastructure: this.infraProtectionEnabled,
            strict: this.strictProtectionEnabled,
            noDelete: this.noDeleteProtectionEnabled,
          },
          summary: {
            mostRestrictiveActive: this.strictProtectionEnabled ? "strict" : this.infraProtectionEnabled ? "infrastructure" : this.noDeleteProtectionEnabled ? "noDelete" : "none",
            allModesDisabled: !this.infraProtectionEnabled && !this.strictProtectionEnabled && !this.noDeleteProtectionEnabled,
          },
        };
      },
    }]);
  }

  private setupHealthCheck(): void {
    // Periodic health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.k8sClient.getClusterVersion();
        this.isHealthy = true;
        this.lastHealthCheck = new Date();
      } catch (error) {
        this.isHealthy = false;
        this.lastError = error instanceof Error ? error.message : String(error);
        this.lastHealthCheck = new Date();
      }
      // Prune expired cache entries periodically
      this.pruneCache();
    }, 30000);
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.error(`Received ${signal}, shutting down gracefully...`);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.circuitBreakerTimer) clearTimeout(this.circuitBreakerTimer);
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  private setupErrorHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.errorCount++;
      this.lastError = error.message;
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.errorCount++;
      this.lastError = String(reason);
    });
  }

  private validateArguments(schema: any, args: any): string | null {
    if (!args) return null;

    const required = schema.required || [];
    for (const field of required) {
      if (!(field in args)) {
        return `Missing required parameter: ${field}`;
      }
    }

    const properties = schema.properties || {};
    for (const [key, value] of Object.entries(args)) {
      if (properties[key]) {
        const prop = properties[key] as any;

        // Type checks
        if (prop.type === 'string' && typeof value !== 'string') {
          return `Parameter '${key}' must be a string, got ${typeof value}`;
        }
        if (prop.type === 'number' && typeof value !== 'number') {
          return `Parameter '${key}' must be a number, got ${typeof value}`;
        }
        if (prop.type === 'boolean' && typeof value !== 'boolean') {
          return `Parameter '${key}' must be a boolean, got ${typeof value}`;
        }
        if (prop.type === 'array' && !Array.isArray(value)) {
          return `Parameter '${key}' must be an array, got ${typeof value}`;
        }

        // Enum validation
        if (prop.enum && Array.isArray(prop.enum) && !prop.enum.includes(value)) {
          return `Parameter '${key}' must be one of: ${prop.enum.join(', ')}. Got: '${value}'`;
        }

        // Number range validation
        if (prop.type === 'number' && typeof value === 'number') {
          if (prop.minimum !== undefined && value < prop.minimum) {
            return `Parameter '${key}' must be >= ${prop.minimum}, got ${value}`;
          }
          if (prop.maximum !== undefined && value > prop.maximum) {
            return `Parameter '${key}' must be <= ${prop.maximum}, got ${value}`;
          }
        }

        // String length validation
        if (prop.type === 'string' && typeof value === 'string') {
          if (prop.minLength !== undefined && value.length < prop.minLength) {
            return `Parameter '${key}' must be at least ${prop.minLength} characters`;
          }
          if (prop.maxLength !== undefined && value.length > prop.maxLength) {
            return `Parameter '${key}' must be at most ${prop.maxLength} characters`;
          }
        }
      }
    }

    return null;
  }

  private updateToolMetrics(toolName: string, startTime: number, success: boolean, error?: string): void {
    const responseTime = Date.now() - startTime;
    
    if (!this.toolMetrics.has(toolName)) {
      this.toolMetrics.set(toolName, {
        name: toolName,
        calls: 0,
        errors: 0,
        avgResponseTime: 0,
      });
    }
    
    const metrics = this.toolMetrics.get(toolName)!;
    metrics.calls++;
    metrics.lastCalled = new Date();
    
    if (success) {
      // Update average response time
      metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.calls - 1) + responseTime) / metrics.calls;
    } else {
      metrics.errors++;
      metrics.lastError = error;
    }
  }

  private openCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    console.error("Circuit breaker OPEN due to high error rate");
    
    // Auto-reset after timeout
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
    }
    
    this.circuitBreakerTimer = setTimeout(() => {
      this.circuitBreakerOpen = false;
      this.recentErrors = [];
      console.error("Circuit breaker CLOSED - accepting requests again");
    }, this.config.circuitBreakerTimeout);
  }

  // Sliding window error tracking
  private trackError(): void {
    this.recentErrors.push(Date.now());
  }

  private getRecentErrorCount(): number {
    const oneMinuteAgo = Date.now() - 60000;
    this.recentErrors = this.recentErrors.filter(t => t > oneMinuteAgo);
    return this.recentErrors.length;
  }

  // Response cache methods (delegated to CacheManager)
  private getFromCache(key: string): any | undefined {
    return this.cacheManager.get(key);
  }

  private setCache(key: string, data: any, ttl?: number): void {
    this.cacheManager.set(key, data, ttl);
  }

  private pruneCache(): void {
    this.cacheManager.prune();
  }

  private getUptime(): string {
    const now = new Date();
    const diff = now.getTime() - this.startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Kubernetes MCP Server v${packageJson.version} running on stdio`);
    console.error(`Tools registered: ${this.toolRegistry.size()}`);
    console.error(`Infrastructure Protection: ${this.infraProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    console.error(`Strict Protection: ${this.strictProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    if (this.strictProtectionEnabled) {
      const blockedCount = Array.from(this.toolRegistry.getAllTools().keys())
        .filter(name => !this.READ_ONLY_TOOLS.has(name)).length;
      console.error(`  └─ ${blockedCount} modification tools blocked, ${this.READ_ONLY_TOOLS.size} read-only tools available`);
    }
    console.error(`No Delete Protection: ${this.noDeleteProtectionEnabled ? "ENABLED" : "DISABLED"}`);
    if (this.noDeleteProtectionEnabled) {
      console.error(`  └─ ${this.DELETION_TOOLS.size} delete operations blocked, updates still allowed`);
    }
    console.error(`Started at: ${this.startTime.toISOString()}`);
  }
}

const server = new K8sMcpServer();
server.start().catch(console.error);
