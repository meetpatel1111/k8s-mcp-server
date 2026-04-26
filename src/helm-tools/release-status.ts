import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseStatusTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_status",
        description: "Get status of a Helm release (like helm status)",
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
            revision: {
              type: "number",
              description: "Specific revision (default: current)",
            },
            showDesc: {
              type: "boolean",
              description: "Show description in output",
              default: false,
            },
            showResources: {
              type: "boolean",
              description: "Show resources in output",
              default: false,
            },
            output: {
              type: "string",
              description: "Output format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
              default: "json",
            },
          },
          required: ["release"],
        },
      },
      handler: async ({
        release,
        namespace,
        revision,
        showDesc,
        showResources,
        output,
      }: {
        release: string;
        namespace?: string;
        revision?: number;
        showDesc?: boolean;
        showResources?: boolean;
        output?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["status", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          if (showDesc) args.push("--show-description");
          if (showResources) args.push("--show-resources");
          if (output) args.push("--output", sanitizeShellArg(output));
          
          // Use parseHelmJson only for json output (it adds -o json)
          let status;
          if (!output || output === "json") {
            status = parseHelmJson(args);
          } else {
            // For table/yaml, use regular runHelm
            const outputStr = runHelm(args);
            status = { raw: outputStr };
          }
          return {
            release: sanitizedRelease,
            namespace: ns,
            status,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_status", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
