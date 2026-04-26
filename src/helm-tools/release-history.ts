import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseHistoryTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_history",
        description: "Get release history of a Helm chart (like helm history)",
        inputSchema: {
          type: "object",
          properties: {
            release: {
              type: "string",
              description: "Release name",
            },
            namespace: {
              type: "string",
              description: "Release namespace",
              default: "default",
            },
            max: {
              type: "number",
              description: "Maximum number of revisions to show (default: 256)",
            },
            output: {
              type: "string",
              description: "Prints the output in the specified format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
            },
          },
          required: ["release"],
        },
      },
      handler: async ({
        release,
        namespace,
        max,
        output,
      }: {
        release: string;
        namespace?: string;
        max?: number;
        output?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["history", sanitizedRelease, "-n", ns];
          if (max && max > 0) args.push("--max", String(max));
          if (output) args.push("--output", sanitizeShellArg(output));
          const history = parseHelmJson(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            history: history || [],
            count: history?.length || 0,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_history", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
