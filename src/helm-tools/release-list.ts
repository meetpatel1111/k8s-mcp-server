import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseListTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_list",
        description: "List Helm releases (like helm list). Shows all installed Helm charts.",
        inputSchema: {
          type: "object",
          properties: {
            namespace: {
              type: "string",
              description: "Namespace to filter (default: all namespaces)",
            },
            allNamespaces: {
              type: "boolean",
              description: "List releases across all namespaces",
              default: false,
            },
            filter: {
              type: "string",
              description: "Filter releases by name (regex)",
            },
            deployed: {
              type: "boolean",
              description: "Show deployed releases",
              default: false,
            },
            failed: {
              type: "boolean",
              description: "Show failed releases",
              default: false,
            },
            pending: {
              type: "boolean",
              description: "Show pending releases",
              default: false,
            },
            date: {
              type: "boolean",
              description: "Sort by release date",
              default: false,
            },
            reverse: {
              type: "boolean",
              description: "Reverse sort order",
              default: false,
            },
            offset: {
              type: "number",
              description: "Skip N releases for pagination",
            },
            max: {
              type: "number",
              description: "Maximum number of releases to fetch (default: 256)",
            },
            noHeaders: {
              type: "boolean",
              description: "Don't print headers when using the default output format",
              default: false,
            },
            output: {
              type: "string",
              description: "Prints the output in the specified format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
            },
            selector: {
              type: "string",
              description: "Selector (label query) to filter on (e.g., key1=value1,key2=value2)",
            },
            short: {
              type: "boolean",
              description: "Output short (quiet) listing format",
              default: false,
            },
            superseded: {
              type: "boolean",
              description: "Show superseded releases",
              default: false,
            },
            timeFormat: {
              type: "string",
              description: "Format time using golang time formatter (e.g., 2006-01-02 15:04:05Z0700)",
            },
            uninstalled: {
              type: "boolean",
              description: "Show uninstalled releases (if --keep-history was used)",
              default: false,
            },
            uninstalling: {
              type: "boolean",
              description: "Show releases currently being uninstalled",
              default: false,
            },
          },
        },
      },
      handler: async ({
        namespace,
        allNamespaces,
        filter,
        deployed,
        failed,
        pending,
        date,
        reverse,
        offset,
        max,
        noHeaders,
        output,
        selector,
        short,
        superseded,
        timeFormat,
        uninstalled,
        uninstalling,
      }: {
        namespace?: string;
        allNamespaces?: boolean;
        filter?: string;
        deployed?: boolean;
        failed?: boolean;
        pending?: boolean;
        date?: boolean;
        reverse?: boolean;
        offset?: number;
        max?: number;
        noHeaders?: boolean;
        output?: string;
        selector?: string;
        short?: boolean;
        superseded?: boolean;
        timeFormat?: string;
        uninstalled?: boolean;
        uninstalling?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["list"];
          if (allNamespaces) args.push("-A");
          else if (namespace) args.push("-n", sanitizeShellArg(namespace));
          if (filter) args.push("--filter", sanitizeShellArg(filter));
          if (deployed) args.push("--deployed");
          if (failed) args.push("--failed");
          if (pending) args.push("--pending");
          if (date) args.push("--date");
          if (reverse) args.push("--reverse");
          if (offset && offset > 0) args.push("--offset", String(offset));
          if (max && max > 0) args.push("--max", String(max));
          if (noHeaders) args.push("--no-headers");
          if (output) args.push("--output", sanitizeShellArg(output));
          if (selector) args.push("--selector", sanitizeShellArg(selector));
          if (short) args.push("--short");
          if (superseded) args.push("--superseded");
          if (timeFormat) args.push("--time-format", sanitizeShellArg(timeFormat));
          if (uninstalled) args.push("--uninstalled");
          if (uninstalling) args.push("--uninstalling");
          const releases = parseHelmJson(args);
          return {
            releases: releases || [],
            count: releases?.length || 0,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_list", namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
