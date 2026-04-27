import { Server as HTTPServer } from "http";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { K8sClient } from "./k8s-client.js";
import { CacheManager } from "./cache-manager.js";
import { ToolRegistry } from "./tool-registry.js";
import { loadConfig } from "./config.js";
import { initializeTelemetry } from "./telemetry.js";
import { createRequire } from "module";

// Import all tool registration functions
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
import { registerDiagnosticsTools } from "./k8s-tools/diagnostics.js";
import { registerMultiClusterTools } from "./k8s-tools/multi-cluster.js";
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

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

// Track active connections
interface Connection {
  id: string;
  transport: SSEServerTransport;
  server: Server;
  res: Response;
}
const activeConnections = new Map<string, Connection>();

// Shared resources across all connections
let sharedK8sClient: K8sClient | null = null;
let sharedCacheManager: CacheManager | null = null;

function getSharedResources() {
  if (!sharedK8sClient) {
    const config = loadConfig();
    sharedCacheManager = new CacheManager(config.cacheDefaultTtl);
    sharedK8sClient = new K8sClient();
  }
  return { k8sClient: sharedK8sClient, cacheManager: sharedCacheManager! };
}

function createToolRegistry() {
  const toolRegistry = new ToolRegistry();
  const { k8sClient, cacheManager } = getSharedResources();

  // Register all tool categories
  const registerTools = (tools: { tool: any; handler: Function }[]) => {
    tools.forEach(({ tool, handler }) => {
      toolRegistry.register({ tool, handler });
    });
  };

  registerTools(registerClusterTools(k8sClient));
  registerTools(registerNodeTools(k8sClient));
  registerTools(registerPodTools(k8sClient));
  registerTools(registerWorkloadTools(k8sClient));
  registerTools(registerNetworkingTools(k8sClient));
  registerTools(registerStorageTools(k8sClient));
  registerTools(registerSecurityTools(k8sClient));
  registerTools(registerMonitoringTools(k8sClient));
  registerTools(registerConfigTools(k8sClient));
  registerTools(registerAdvancedTools(k8sClient, cacheManager));
  registerTools(registerTemplateTools(k8sClient));
  registerTools(registerWebSocketTools(k8sClient));
  registerTools(registerHelmReleaseListTools(k8sClient));
  registerTools(registerHelmReleaseStatusTools(k8sClient));
  registerTools(registerHelmReleaseHistoryTools(k8sClient));
  registerTools(registerHelmReleaseGetValuesTools(k8sClient));
  registerTools(registerHelmReleaseInstallTools(k8sClient));
  registerTools(registerHelmReleaseUninstallTools(k8sClient));
  registerTools(registerHelmReleaseUpgradeTools(k8sClient));
  registerTools(registerHelmReleaseRollbackTools(k8sClient));
  registerTools(registerHelmReleaseTestTools(k8sClient));
  registerTools(registerHelmReleaseGetInfoTools(k8sClient));
  registerTools(registerHelmSearchHubTools(k8sClient));
  registerTools(registerHelmRepoManagementTools(k8sClient));
  registerTools(registerHelmShowChartTools(k8sClient));
  registerTools(registerHelmChartManagementTools(k8sClient));
  registerTools(registerHelmChartTemplateTools(k8sClient));
  registerTools(registerHelmDependencyManagementTools(k8sClient));
  registerTools(registerHelmPluginManagementTools(k8sClient));
  registerTools(registerHelmRegistryManagementTools(k8sClient));
  registerTools(registerHelmEnvironmentTools(k8sClient));
  registerTools(registerDiagnosticsTools(k8sClient));
  registerTools(registerMultiClusterTools(k8sClient));

  return toolRegistry;
}

export async function startSSEServer(port: number = 3000): Promise<void> {
  // Initialize telemetry once
  initializeTelemetry();

  const app = express();
  
  // Enable CORS for web clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      transport: "sse",
      activeConnections: activeConnections.size,
      version: packageJson.version
    });
  });

  // SSE endpoint for MCP - creates a new Server instance per connection
  app.get("/sse", async (req: Request, res: Response) => {
    const sessionId = crypto.randomUUID();
    console.log(`[SSE] New connection: ${sessionId} (total: ${activeConnections.size + 1})`);
    
    try {
      // Create a new Server instance for this connection
      const server = new Server(
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

      // Create tool registry for this connection
      const toolRegistry = createToolRegistry();
      
      // Set up request handlers for this server instance
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: Array.from(toolRegistry.getAllTools().values()),
        };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const handler = toolRegistry.getHandler(name);

        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler(args || {});
        return {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        };
      });

      // Create SSE transport
      const transport = new SSEServerTransport("/message", res);
      
      // Store connection
      const connection: Connection = {
        id: sessionId,
        transport,
        server,
        res
      };
      activeConnections.set(sessionId, connection);
      
      // Handle connection close
      res.on("close", () => {
        console.log(`[SSE] Connection closed: ${sessionId}`);
        activeConnections.delete(sessionId);
      });
      
      // Connect server to transport
      await server.connect(transport);
      console.log(`[SSE] Connection established: ${sessionId}`);
      
    } catch (error: any) {
      console.error(`[SSE] Connection error for ${sessionId}:`, error);
      activeConnections.delete(sessionId);
      res.status(500).json({ error: error.message });
    }
  });

  // Message endpoint - must handle POST from SSE transport
  app.post("/message", async (req: Request, res: Response) => {
    // Find the transport for this session (MCP SDK handles session tracking via query param)
    const sessionId = req.query.sessionId as string;
    const connection = sessionId ? activeConnections.get(sessionId) : null;
    
    if (connection) {
      // Let the transport handle the message
      await connection.transport.handlePostMessage(req, res);
    } else {
      // No specific session, return status
      res.json({ status: "ok", activeConnections: activeConnections.size });
    }
  });

  const httpServer = new HTTPServer(app);
  
  httpServer.listen(port, () => {
    console.log(`SSE server listening on port ${port}`);
    console.log(`SSE endpoint: http://localhost:${port}/sse`);
    console.log(`Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[SSE] Shutting down...");
    activeConnections.clear();
    httpServer.close(() => {
      console.log("SSE server closed");
    });
  });

  process.on("SIGINT", () => {
    console.log("[SSE] Shutting down...");
    activeConnections.clear();
    httpServer.close(() => {
      console.log("SSE server closed");
    });
  });
}

// Import required schemas
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
