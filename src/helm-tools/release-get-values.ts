import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";

export function registerHelmReleaseGetValuesTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_values",
        description: "Get the values of a Helm release (like helm get values)",
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
            allValues: {
              type: "boolean",
              description: "Show all computed values including defaults",
              default: false,
            },
            output: {
              type: "string",
              description: "Prints the output in the specified format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
            },
            scrubSecrets: {
              type: "boolean",
              description: "Mask potential secrets in values output (passwords, tokens, keys)",
              default: false,
            },
          },
          required: ["release"],
        },
      },
      handler: async ({
        release,
        namespace,
        revision,
        allValues,
        output,
        scrubSecrets,
      }: {
        release: string;
        namespace?: string;
        revision?: number;
        allValues?: boolean;
        output?: string;
        scrubSecrets?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "values", sanitizedRelease, "-n", ns];
          if (allValues) args.push("--all");
          if (revision && revision > 0) args.push("--revision", String(revision));
          if (output) args.push("--output", sanitizeShellArg(output));
          const rawValues = parseHelmJson(args);
          const values = scrubSecrets ? scrubSensitiveData(JSON.stringify(rawValues)) : rawValues;
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            values: scrubSecrets ? JSON.parse(values) : values,
            scrubbed: scrubSecrets || false,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_values", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
