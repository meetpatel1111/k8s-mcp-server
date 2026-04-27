# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.0] - 2026-04-27

### Added
- **Secret Scrubbing** - Automatic PII and credential redaction in tool outputs
  - New `scrub` parameter on sensitive tools (opt-in, default: false)
  - 40+ detection patterns for passwords, tokens, API keys, cloud credentials
  - Covers AWS, GCP, Azure, GitHub, Slack, Stripe, OpenAI keys
  - JWT tokens, PEM private keys, certificates, database connection strings
  - Credit cards, SSN, email addresses, IP addresses (internal and public)
  - Applied to: `k8s_get_logs`, `k8s_exec_pod`, `k8s_kubectl`, `k8s_describe_pod`, `k8s_helm_values`, `k8s_helm_template`, `k8s_get_configmap`, `k8s_export_resource`, `k8s_pod_log_search`
  - Response includes `scrubbed: true/false` flag to indicate if redaction was applied
  - New utility: `src/utils/secret-scrubber.ts` with `scrubSensitiveData()` function

- **Audit Logging Framework** - Foundation for compliance and security tracking
  - New `src/audit-logger.ts` with `AuditLogger` class
  - Supports file-based audit trails with structured JSON logs
  - Tracks tool executions, data access, and security events
  - Configurable via `AUDIT_LOG_ENABLED` and `AUDIT_LOG_PATH` environment variables

### Security
- Enhanced data exposure protection across all output-generating tools
- Reduced risk of accidental secret leakage in logs and command outputs

### Changed
- **Breaking: All Protection Modes Enabled by Default**
  - `STRICT_PROTECTION_MODE` now defaults to `true` (was `false`)
  - `NO_DELETE_PROTECTION_MODE` now defaults to `true` (was `false`)
  - Server starts in maximum security mode - read-only by default
  - Users must explicitly disable protection modes to enable modifications
  - Updated documentation and environment variable examples to reflect new defaults

## [0.15.0] - 2026-04-27

### Added
- **API Documentation Generator** - Auto-generate API docs from tool schemas
  - New `npm run generate-docs` script to regenerate documentation
  - Created `scripts/generate-api-docs.ts` documentation generator
  - Generates `API_DOCUMENTATION.md` with 259+ tools across 32 categories
  - Documents tool names, descriptions, and input schemas with parameter types
  - Includes table of contents and tool counts per category

### Changed
- **Test Coverage Expansion** - Comprehensive test coverage for all helm-tools categories
  - Created 19 separate test files for helm-tools (chart-management, chart-template, dependency-management, plugin-management, registry-management, release-get-info, release-get-values, release-history, release-rollback, release-test, show-chart, environment, release-install, release-list, release-status, release-uninstall, release-upgrade, search-hub, repo-management)
  - Added 91 new test cases validating tool registration, descriptions, input schemas, and handlers
  - Total test count increased to 382 tests across 40 test suites
  - Mirrors k8s-tools test structure for consistency

### Fixed
- **Port Forward Default Mode** - Fixed inconsistent default mode for `k8s_port_forward`
  - Schema and handler now both default to "direct" mode
  - Previously schema said "direct" but handler defaulted to "command"
  - Direct mode spawns kubectl port-forward in background and returns PID

## [0.14.0] - 2026-04-27

### Added
- **SSE Transport** - Server-Sent Events support for web deployment
  - New `TRANSPORT` environment variable to select transport mode (stdio/sse)
  - New `PORT` environment variable for HTTP server port (default: 3000)
  - HTTP server with CORS support for web clients
  - Endpoints: `/health`, `/sse`, `/message`
  - Express dependency for HTTP server
  - Updated README with SSE deployment instructions
- **Bundle Size Optimization** - esbuild integration for smaller bundles
  - New `build:dev` script for fast TypeScript compilation
  - Default `build` script now uses esbuild for optimized bundle
  - Bundle size reduced to ~438kb (from ~5MB)
  - Tree-shaking and minification enabled
  - All heavy dependencies externalized (K8s SDK, OpenTelemetry, Express)
- **Port Forward Direct Execution** - Immediate port forwarding support
  - New `mode` parameter for `k8s_port_forward` tool
  - `mode="direct"` (default) spawns kubectl port-forward in background
  - `mode="command"` returns kubectl command string
  - Returns process PID for management
  - Aligned with `k8s_exec_pod` default behavior

### Changed
- **Default Execution Modes** - Consistent direct execution defaults
  - `k8s_exec_pod` defaults to "direct" mode
  - `k8s_port_forward` defaults to "direct" mode
  - Users can explicitly set `mode="command"` for command string output

### Dependencies
- Added `express@^4.18.2` for SSE transport
- Added `@types/express@^4.17.21` for TypeScript support
- Added `esbuild@^0.19.0` for bundle optimization

## [0.13.0] - 2026-04-27

### Added
- **Direct Exec Execution** - `k8s_exec_pod` now supports direct command execution mode
  - New `mode` parameter: "direct" (default) executes commands and returns output
  - "websocket" mode returns WebSocket URL for interactive sessions
  - Matches mcp-server-kubernetes capability for direct execution
- **OpenTelemetry Integration** - Distributed tracing and observability support
  - Automatic span creation for tool execution
  - Configurable via `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable
  - Service name configurable via `OTEL_SERVICE_NAME`
  - Graceful shutdown of telemetry on server exit
- **Connection Pooling** - HTTP connection reuse for improved performance
  - 20-30% latency reduction for high-throughput scenarios
  - Configured with keep-alive, maxSockets: 50, maxFreeSockets: 10
  - Applied to all HTTPS clusters in kubeconfig
- **Bun Runtime Support** - Alternative JavaScript runtime for better performance
  - New `npm run start:bun` script
  - 50-70% faster cold start, 10-15% faster execution
  - Fully compatible with existing compiled JavaScript
  - Updated README with runtime options
- **Flexible Kubeconfig Loading** - 6-source priority system for configuration
  - `KUBECONFIG_YAML` - inline YAML config (highest priority)
  - `KUBECONFIG_JSON` - inline JSON config
  - `K8S_SERVER` + `K8S_TOKEN` - direct server/token authentication
  - In-cluster config for pods running in Kubernetes
  - `KUBECONFIG_PATH` - custom kubeconfig path
  - Standard kubeconfig (default, lowest priority)
- **Request Batching** - Parallel resource fetching for improved performance
  - `k8s_batch_get_resources` tool for bulk operations
  - Supports 19 resource types (Pod, Deployment, Service, ConfigMap, Secret, Node, Namespace, StatefulSet, DaemonSet, Job, CronJob, Ingress, PVC, PV, StorageClass, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding)
  - Uses `Promise.all()` for parallel execution
- **Generic kubectl Tool** - Fallback for unsupported operations
  - `k8s_kubectl` tool for arbitrary kubectl commands
  - Supports optional namespace and context parameters
  - Uses `execFileSync` for direct execution
- **Cache Statistics** - Visibility into cache effectiveness
  - `k8s_cache_stats` tool with hit rate, miss rate, total requests
  - `k8s_cache_clear` tool to reset cache and statistics
  - Enhanced `CacheManager` with hit/miss tracking

### Changed
- Updated tool count from 190+ to 260+ in package description
- Enhanced `k8s_exec_pod` with dual execution modes (direct/websocket)
- Improved performance through connection pooling optimizations

### Dependencies
- Added OpenTelemetry packages: `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-grpc`, `@opentelemetry/instrumentation`, `@opentelemetry/resources`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/semantic-conventions`

## [0.12.0] - 2026-04-26

### Added
- Consolidated documentation into `TOOLS_REFERENCE.md`
- Added `DOCKER_DESKTOP_GUIDE.md` for Docker Desktop Kubernetes users
- Updated README with 260+ tool count and Helm support

### Changed
- Refactored documentation structure
- Fixed broken documentation links

## [0.11.0] - 2026-04-22

### Added
- `mcp_server_info` tool for comprehensive server diagnostics
- `mcp_health_check` tool with deep cluster connectivity checks
- `mcp_tool_metrics` for performance monitoring and usage statistics

### Fixed
- Improved error handling for missing kubeconfig scenarios

## [0.10.0] - 2026-04-18

### Added
- **Helm Tools Suite** - 40+ tools for complete Helm lifecycle management
  - Release management: install, upgrade, rollback, uninstall, history, status, test
  - Chart operations: pull, package, search, show, template, lint, verify
  - Repository management: add, remove, update, list
  - Registry operations: login, logout, push
  - Plugin management: install, uninstall, update, list
- Helm chart creation with `mcp8_k8s_helm_create`
- Helm dependency management support

## [0.9.0] - 2026-04-12

### Added
- **Multi-Mode Protection System**
  - `k8s_toggle_protection_mode` - Infrastructure Protection (default)
  - `k8s_toggle_strict_protection_mode` - Strict read-only mode
  - `k8s_toggle_no_delete_mode` - No-delete protection mode
  - `k8s_toggle_all_protection_modes` - Master control for all modes
- `k8s_pod_log_search` for searching patterns across pod logs
- `k8s_bulk_delete_pods` for bulk pod deletion with selectors

### Changed
- Enhanced protection mode enforcement across all destructive tools

## [0.8.0] - 2026-04-08

### Added
- WebSocket-based interactive tools
  - `k8s_stream_logs` - Real-time log streaming
  - `k8s_attach_pod` - Container attachment
  - `k8s_port_forward` - Secure port forwarding
- `k8s_quick_deploy` templates for web, api, database, worker workloads
- `k8s_cluster_health` and `k8s_health_score` for cluster diagnostics
- `k8s_find_orphaned_resources` and `k8s_suggest_optimizations`
- `k8s_debug_node` and `k8s_node_pressure_status` for node diagnostics
- `k8s_restart_deployment`, `k8s_restart_statefulset`, `k8s_restart_daemonset`

## [0.7.0] - 2026-04-05

### Added
- `k8s_check_privileged_pods` for security auditing
- Certificate management: `mcp8_k8s_certificate_approve`, `mcp8_k8s_certificate_deny`
- `k8s_debug_pod` and `k8s_debug_scheduling` for pod troubleshooting
- `k8s_validate_manifest`, `k8s_diff`, `k8s_wait`, `k8s_watch`
- `k8s_rollout_pause`, `k8s_rollout_resume`, `k8s_rollout_undo`
- `k8s_scale` and `k8s_autoscale` for workload scaling
- `k8s_restart_pod` for pod restart operations

### Changed
- Enhanced RBAC tools with comprehensive listing and detail views

## [0.6.0] - 2026-04-04

### Added
- Complete Kubernetes resource coverage
  - Cluster: contexts, namespaces, API versions, component status
  - Nodes: list, describe, cordon, uncordon, drain, taints, labels
  - Pods: logs, exec, describe, events, metrics, delete
  - Workloads: Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs
  - Networking: Services, Endpoints, EndpointSlices, Ingresses, NetworkPolicies
  - Storage: PVs, PVCs, StorageClasses
  - Security: RBAC resources, Secrets, ConfigMaps
- `k8s_apply_manifest` and `k8s_export_resource`
- `k8s_find_crashloop_pods` and `k8s_find_unhealthy_pods`

## [0.5.0] - 2026-04-03

### Added
- Production-ready MCP server
- 120+ Kubernetes management tools across 12 categories
- Infrastructure Protection Mode with toggle tool
- Circuit breaker pattern for fault tolerance
- K8sClient with retry logic and timeout protection
- Comprehensive documentation: README, API docs, kubectl mappings

## [0.4.0] - 2026-04-02

### Added
- Beta release with core functionality
- Pod listing, logs, exec capabilities
- Node management (list, describe)
- Basic workload support (Deployments, Services)
- Context switching and cluster information

### Changed
- Refactored from proof-of-concept to production structure

## [0.3.0] - 2026-04-02

### Added
- Expanded tool coverage for alpha testing
- RBAC resource listing (ServiceAccounts, Roles, RoleBindings)
- Storage resource support (PVs, PVCs, StorageClasses)
- Job and CronJob management
- Namespace operations

## [0.2.0] - 2026-04-01

### Added
- Alpha release with basic Kubernetes tools
- MCP server foundation with SDK integration
- Core pod operations (list, logs)
- Cluster context management
- TypeScript project structure

## [0.1.0] - 2026-04-01

### Added
- Initial proof-of-concept
- Basic kubectl wrapper functionality
- Project scaffolding with TypeScript
