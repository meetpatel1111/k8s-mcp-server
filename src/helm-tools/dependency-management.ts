import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";

export function registerHelmDependencyManagementTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_dependency",
        description: "Manage Helm chart dependencies (list, update, build)",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Dependency command",
              enum: ["list", "update", "build"],
            },
            chart: {
              type: "string",
              description: "Path to the chart",
            },
          },
          required: ["command", "chart"],
        },
      },
      handler: async ({ command, chart }: { command: string; chart: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const args: string[] = ["dependency", sanitizeShellArg(command), sanitizedChart];
          const output = runHelm(args, 60000);
          return {
            success: true,
            command,
            chart: sanitizedChart,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_dependency", resource: chart };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
