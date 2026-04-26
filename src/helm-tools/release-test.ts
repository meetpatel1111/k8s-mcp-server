import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseTestTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_test",
        description: "Run tests for a Helm release",
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
            timeout: {
              type: "string",
              description: "Time to wait (e.g., '5m')",
            },
            logs: {
              type: "boolean",
              description: "Dump pod logs on failure",
              default: false,
            },
            filter: {
              type: "string",
              description: "Filter tests by attribute using name=value syntax (e.g., name=test1 or !name=test2 to exclude)",
            },
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, timeout, logs, filter }: {
        release: string;
        namespace?: string;
        timeout?: string;
        logs?: boolean;
        filter?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["test", sanitizedRelease, "-n", ns];
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          if (logs) args.push("--logs");
          if (filter) args.push("--filter", sanitizeShellArg(filter));
          const output = runHelm(args, 300000);
          return {
            success: true,
            release: sanitizedRelease,
            namespace: ns,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_test", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
