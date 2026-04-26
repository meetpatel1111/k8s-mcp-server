import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseGetInfoTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_get_manifest",
        description: "Get the manifest of a named release (generated Kubernetes resources)",
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
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, revision }: {
        release: string;
        namespace?: string;
        revision?: number;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "manifest", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          const output = runHelm(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            manifest: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_get_manifest", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_get_notes",
        description: "Get the notes of a named release",
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
              description: "Specific revision",
            },
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, revision }: {
        release: string;
        namespace?: string;
        revision?: number;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "notes", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          const output = runHelm(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            notes: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_get_notes", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_get_hooks",
        description: "Get the hooks of a named release",
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
              description: "Specific revision",
            },
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, revision }: {
        release: string;
        namespace?: string;
        revision?: number;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "hooks", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          const output = runHelm(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            hooks: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_get_hooks", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_get_all",
        description: "Get all information about a release (values, manifest, hooks, notes)",
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
              description: "Specific revision",
            },
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, revision }: {
        release: string;
        namespace?: string;
        revision?: number;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "all", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          const output = runHelm(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            info: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_get_all", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_get_metadata",
        description: "Fetch metadata for a Helm release",
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
            output: {
              type: "string",
              description: "Prints the output in the specified format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
            },
          },
          required: ["release"],
        },
      },
      handler: async ({ release, namespace, revision, output }: {
        release: string;
        namespace?: string;
        revision?: number;
        output?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["get", "metadata", sanitizedRelease, "-n", ns];
          if (revision && revision > 0) args.push("--revision", String(revision));
          if (output) args.push("--output", sanitizeShellArg(output));
          const metadataResult = parseHelmJson(args);
          return {
            release: sanitizedRelease,
            namespace: ns,
            revision,
            metadata: metadataResult,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_get_metadata", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
