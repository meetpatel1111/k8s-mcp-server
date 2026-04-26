import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseUninstallTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_uninstall",
        description: "Uninstall a Helm release",
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
            keepHistory: {
              type: "boolean",
              description: "Remove all associated resources and mark the release as deleted, but retain the release history",
              default: false,
            },
            wait: {
              type: "boolean",
              description: "Wait until resources are deleted",
              default: false,
            },
            timeout: {
              type: "string",
              description: "Time to wait (e.g., '5m', '300s')",
            },
            noHooks: {
              type: "boolean",
              description: "Prevent hooks from running during uninstall",
              default: false,
            },
            cascade: {
              type: "string",
              description: "Deletion cascading strategy (background, orphan, foreground)",
              enum: ["background", "orphan", "foreground"],
            },
            description: {
              type: "string",
              description: "Add a custom description for the uninstall",
            },
            dryRun: {
              type: "boolean",
              description: "Simulate uninstall without actually deleting",
              default: false,
            },
            ignoreNotFound: {
              type: "boolean",
              description: "Treat 'release not found' as successful uninstall",
              default: false,
            },
          },
          required: ["release"],
        },
      },
      handler: async ({
        release,
        namespace,
        keepHistory,
        wait,
        timeout,
        noHooks,
        cascade,
        description,
        dryRun,
        ignoreNotFound,
      }: {
        release: string;
        namespace?: string;
        keepHistory?: boolean;
        wait?: boolean;
        timeout?: string;
        noHooks?: boolean;
        cascade?: string;
        description?: string;
        dryRun?: boolean;
        ignoreNotFound?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["uninstall", sanitizedRelease, "-n", ns];
          if (keepHistory) args.push("--keep-history");
          if (wait) args.push("--wait");
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          if (noHooks) args.push("--no-hooks");
          if (cascade) args.push("--cascade", sanitizeShellArg(cascade));
          if (description) args.push("--description", sanitizeShellArg(description));
          if (dryRun) args.push("--dry-run");
          if (ignoreNotFound) args.push("--ignore-not-found");
          const output = runHelm(args, 60000);
          return {
            success: true,
            release: sanitizedRelease,
            namespace: ns,
            output,
            message: `Release '${sanitizedRelease}' uninstalled from namespace '${ns}'`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_uninstall", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
