import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseRollbackTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_rollback",
        description: "Roll back to a previous revision",
        inputSchema: {
          type: "object",
          properties: {
            release: {
              type: "string",
              description: "Release name",
            },
            revision: {
              type: "number",
              description: "Revision number to rollback to (0 for previous)",
              default: 0,
            },
            namespace: {
              type: "string",
              description: "Release namespace",
              default: "default",
            },
            wait: {
              type: "boolean",
              description: "Wait until resources are ready",
              default: false,
            },
            timeout: {
              type: "string",
              description: "Time to wait",
            },
            cleanupOnFail: {
              type: "boolean",
              description: "Allow deletion of new resources on rollback failure",
              default: false,
            },
            noHooks: {
              type: "boolean",
              description: "Prevent hooks from running during rollback",
              default: false,
            },
            recreatePods: {
              type: "boolean",
              description: "Restart pods after rollback",
              default: false,
            },
            dryRun: {
              type: "string",
              description: "Simulate rollback (none, client, server)",
              enum: ["none", "client", "server"],
            },
            forceConflicts: {
              type: "boolean",
              description: "Force changes against conflicts with server-side apply",
              default: false,
            },
            forceReplace: {
              type: "boolean",
              description: "Force resource updates by replacement",
              default: false,
            },
            historyMax: {
              type: "number",
              description: "Maximum revisions saved per release (0=no limit)",
            },
            serverSide: {
              type: "string",
              description: "Server-side apply (true, false, auto)",
              enum: ["true", "false", "auto"],
              default: "auto",
            },
            waitForJobs: {
              type: "boolean",
              description: "Wait for all Jobs to complete before marking success",
              default: false,
            },
          },
          required: ["release"],
        },
      },
      handler: async ({
        release,
        revision,
        namespace,
        wait,
        timeout,
        cleanupOnFail,
        noHooks,
        recreatePods,
        dryRun,
        forceConflicts,
        forceReplace,
        historyMax,
        serverSide,
        waitForJobs,
      }: {
        release: string;
        revision?: number;
        namespace?: string;
        wait?: boolean;
        timeout?: string;
        cleanupOnFail?: boolean;
        noHooks?: boolean;
        recreatePods?: boolean;
        dryRun?: string;
        forceConflicts?: boolean;
        forceReplace?: boolean;
        historyMax?: number;
        serverSide?: string;
        waitForJobs?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["rollback", sanitizedRelease, String(revision ?? 0), "-n", ns];
          if (wait) args.push("--wait");
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          if (cleanupOnFail) args.push("--cleanup-on-fail");
          if (noHooks) args.push("--no-hooks");
          if (recreatePods) args.push("--recreate-pods");
          if (dryRun) args.push("--dry-run", sanitizeShellArg(dryRun));
          if (forceConflicts) args.push("--force-conflicts");
          if (forceReplace) args.push("--force-replace");
          if (historyMax !== undefined && historyMax >= 0) args.push("--history-max", String(historyMax));
          if (serverSide) args.push("--server-side", sanitizeShellArg(serverSide));
          if (waitForJobs) args.push("--wait-for-jobs");
          const output = runHelm(args, 60000);
          return {
            success: true,
            release: sanitizedRelease,
            revision: revision || 0,
            namespace: ns,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_rollback", resource: release, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
