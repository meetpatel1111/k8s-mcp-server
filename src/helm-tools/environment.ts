import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";

export function registerHelmEnvironmentTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_env",
        description: "Display Helm environment information",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const output = runHelm(["env"]);
          return {
            environment: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_env" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_version",
        description: "Display Helm version information",
        inputSchema: {
          type: "object",
          properties: {
            short: {
              type: "boolean",
              description: "Print short version",
              default: false,
            },
            template: {
              type: "string",
              description: "Template to format output (e.g., 'Version: {{.Version}}')",
            },
          },
        },
      },
      handler: async ({ short, template }: { short?: boolean; template?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["version"];
          if (short) args.push("--short");
          if (template) args.push("--template", sanitizeShellArg(template));
          const output = runHelm(args);
          return {
            version: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_version" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
