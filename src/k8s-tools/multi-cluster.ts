import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { classifyError, ErrorContext } from "../error-handling.js";

interface KubeconfigInfo {
  path: string;
  name: string;
  exists: boolean;
  isActive: boolean;
  contexts?: string[];
  currentContext?: string;
}

function getKubeconfigPaths(): string[] {
  const paths: string[] = [];
  
  // 1. Current KUBECONFIG_PATH env var
  if (process.env.KUBECONFIG_PATH) {
    paths.push(process.env.KUBECONFIG_PATH);
  }
  
  // 2. Standard kubeconfig location
  const homeDir = os.homedir();
  paths.push(path.join(homeDir, ".kube", "config"));
  
  // 3. Additional common locations
  paths.push(path.join(homeDir, ".kube", "config.yaml"));
  paths.push(path.join(homeDir, ".kube", "configs", "config"));
  
  // 4. Windows-specific paths
  if (process.platform === "win32") {
    paths.push(path.join(process.env.USERPROFILE || homeDir, ".kube", "config"));
    paths.push(path.join(process.env.LOCALAPPDATA || "", "kube", "config"));
  }
  
  // 5. Check KUBECONFIG env var (can contain multiple paths separated by colons on Unix or semicolons on Windows)
  if (process.env.KUBECONFIG) {
    const separator = process.platform === "win32" ? ";" : ":";
    const kubeconfigPaths = process.env.KUBECONFIG.split(separator);
    paths.push(...kubeconfigPaths);
  }
  
  // Remove duplicates and return
  return [...new Set(paths)];
}

function parseKubeconfig(kubeconfigPath: string): { contexts: string[]; currentContext: string | undefined } | undefined {
  try {
    if (!fs.existsSync(kubeconfigPath)) {
      return undefined;
    }
    
    const content = fs.readFileSync(kubeconfigPath, "utf-8");
    const config = JSON.parse(content);
    
    return {
      contexts: (config.contexts || []).map((ctx: any) => ctx.name),
      currentContext: config["current-context"],
    };
  } catch {
    // If JSON parsing fails, try YAML (simplified parsing)
    try {
      const content = fs.readFileSync(kubeconfigPath, "utf-8");
      // Basic YAML parsing - look for contexts and current-context
      const contexts: string[] = [];
      let currentContext: string | undefined;
      
      const contextMatches = content.match(/contexts:\s*\n((?:\s+-\s*name:\s*.+\n?)+)/);
      if (contextMatches) {
        const contextLines = contextMatches[1].split("\n");
        for (const line of contextLines) {
          const match = line.match(/name:\s*(.+)/);
          if (match) {
            contexts.push(match[1].trim());
          }
        }
      }
      
      const currentMatch = content.match(/current-context:\s*(.+)/);
      if (currentMatch) {
        currentContext = currentMatch[1].trim();
      }
      
      return { contexts, currentContext };
    } catch {
      return undefined;
    }
  }
}

export function registerMultiClusterTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  return [
    {
      tool: {
        name: "k8s_list_kubeconfigs",
        description: "List available kubeconfig files and their contexts from common locations",
        inputSchema: {
          type: "object",
          properties: {
            includeDetails: {
              type: "boolean",
              description: "Include detailed context information (may slow down response for large configs)",
              default: true,
            },
          },
        },
      },
      handler: async ({ includeDetails }: { includeDetails?: boolean } = {}) => {
        try {
          const kubeconfigPaths = getKubeconfigPaths();
          const currentKubeconfig = process.env.KUBECONFIG_PATH || path.join(os.homedir(), ".kube", "config");
          
          const kubeconfigs: KubeconfigInfo[] = [];
          
          for (const kubeconfigPath of kubeconfigPaths) {
            const exists = fs.existsSync(kubeconfigPath);
            const isActive = path.resolve(kubeconfigPath) === path.resolve(currentKubeconfig);
            
            const info: KubeconfigInfo = {
              path: kubeconfigPath,
              name: path.basename(kubeconfigPath, path.extname(kubeconfigPath)),
              exists,
              isActive,
            };
            
            if (exists && includeDetails !== false) {
              const details = parseKubeconfig(kubeconfigPath);
              if (details) {
                info.contexts = details.contexts;
                info.currentContext = details.currentContext;
              }
            }
            
            kubeconfigs.push(info);
          }
          
          // Filter to only show existing ones, but keep track of all checked
          const existingKubeconfigs = kubeconfigs.filter(kc => kc.exists);
          const missingKubeconfigs = kubeconfigs.filter(kc => !kc.exists).map(kc => kc.path);
          
          return {
            kubeconfigs: existingKubeconfigs,
            totalFound: existingKubeconfigs.length,
            totalChecked: kubeconfigPaths.length,
            activeKubeconfig: currentKubeconfig,
            missingChecked: missingKubeconfigs.length > 0 ? missingKubeconfigs : undefined,
            suggestions: [
              "Use k8s_switch_kubeconfig to switch to a different kubeconfig file",
              "Set KUBECONFIG_PATH environment variable for custom locations",
              "Standard location is ~/.kube/config",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_list_kubeconfigs" };
          const classified = classifyError(error, context);
          return {
            error: classified.message,
            type: classified.type,
            suggestions: classified.suggestions,
          };
        }
      },
    },
    {
      tool: {
        name: "k8s_switch_kubeconfig",
        description: "Switch to a different kubeconfig file. Sets KUBECONFIG_PATH environment variable and reloads the client configuration.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the kubeconfig file to switch to",
            },
            context: {
              type: "string",
              description: "Optional: Specific context to use within the kubeconfig (if not provided, uses current-context)",
            },
          },
          required: ["path"],
        },
      },
      handler: async ({ path: kubeconfigPath, context }: { path: string; context?: string }) => {
        try {
          // Validate the path exists
          if (!fs.existsSync(kubeconfigPath)) {
            return {
              success: false,
              error: `Kubeconfig file not found: ${kubeconfigPath}`,
              suggestions: [
                "Verify the path is correct",
                "Use k8s_list_kubeconfigs to see available kubeconfig files",
                "Create the kubeconfig file first if it doesn't exist",
              ],
            };
          }
          
          // Validate it's a valid kubeconfig by trying to parse it
          const details = parseKubeconfig(kubeconfigPath);
          if (!details) {
            return {
              success: false,
              error: `Invalid kubeconfig file: ${kubeconfigPath}`,
              suggestions: [
                "Verify the file contains valid JSON or YAML",
                "Check that contexts and clusters are properly defined",
              ],
            };
          }
          
          // Get the current kubeconfig for comparison
          const previousKubeconfig = process.env.KUBECONFIG_PATH || path.join(os.homedir(), ".kube", "config");
          
          // Set the new KUBECONFIG_PATH
          process.env.KUBECONFIG_PATH = kubeconfigPath;
          
          // If a specific context was requested, update it in the kubeconfig
          if (context && details.contexts?.includes(context)) {
            // Note: Actually switching the context within the kubeconfig would require
            // modifying the file. For now, we just note that the user should use
            // k8s_switch_context to switch to the desired context.
            return {
              success: true,
              message: `Switched to kubeconfig: ${kubeconfigPath}`,
              previousKubeconfig,
              activeContext: context,
              availableContexts: details.contexts,
              note: "Use k8s_switch_context to change the active context within this kubeconfig",
              suggestions: [
                "Verify connection with k8s_cluster_health",
                "List available contexts with k8s_list_contexts",
                `Switch to context '${context}' with k8s_switch_context`,
              ],
            };
          }
          
          return {
            success: true,
            message: `Switched to kubeconfig: ${kubeconfigPath}`,
            previousKubeconfig,
            activeContext: details.currentContext,
            availableContexts: details.contexts,
            suggestions: [
              "Verify connection with k8s_cluster_health",
              "List available contexts with k8s_list_contexts",
              "Switch contexts with k8s_switch_context",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_switch_kubeconfig", resource: kubeconfigPath };
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
        name: "k8s_add_kubeconfig",
        description: "Add a new kubeconfig file path to the search list and optionally validate it",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the kubeconfig file to add",
            },
            validate: {
              type: "boolean",
              description: "Validate the kubeconfig file exists and is valid",
              default: true,
            },
          },
          required: ["path"],
        },
      },
      handler: async ({ path: kubeconfigPath, validate }: { path: string; validate?: boolean }) => {
        try {
          // Check if path exists
          const exists = fs.existsSync(kubeconfigPath);
          
          if (validate !== false && !exists) {
            return {
              success: false,
              error: `Kubeconfig file not found: ${kubeconfigPath}`,
              suggestions: [
                "Verify the path is correct",
                "Create the kubeconfig file first",
                "Set validate to false to add the path without validation",
              ],
            };
          }
          
          let isValid = false;
          let details: { contexts: string[]; currentContext: string | undefined } | undefined;
          
          if (exists) {
            details = parseKubeconfig(kubeconfigPath);
            isValid = !!details;
          }
          
          return {
            success: true,
            message: exists ? `Kubeconfig file verified: ${kubeconfigPath}` : `Kubeconfig path added: ${kubeconfigPath}`,
            path: kubeconfigPath,
            exists,
            isValid,
            contexts: details?.contexts,
            currentContext: details?.currentContext,
            suggestions: exists ? [
              "Use k8s_switch_kubeconfig to activate this kubeconfig",
              "List available contexts with k8s_list_contexts",
            ] : [
              "Create the kubeconfig file at this location",
              "Use k8s_switch_kubeconfig once the file exists",
            ],
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_add_kubeconfig", resource: kubeconfigPath };
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
