import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, helmUnavailableResponse } from "./common.js";

export function registerHelmSearchHubTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_search",
        description: "Search for Helm charts in artifact hub or local repos (like helm search)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Search keyword",
            },
            source: {
              type: "string",
              description: "Search source (hub=Artifact Hub, repo=local repos)",
              enum: ["hub", "repo"],
              default: "repo",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results (default: 25)",
            },
            versions: {
              type: "boolean",
              description: "Show all versions (default: latest only)",
              default: false,
            },
            devel: {
              type: "boolean",
              description: "Use development versions (alpha, beta, release candidates)",
              default: false,
            },
            version: {
              type: "string",
              description: "Semantic version constraint (e.g., ^1.0.0)",
            },
            regexp: {
              type: "boolean",
              description: "Use regular expressions for searching",
              default: false,
            },
            output: {
              type: "string",
              description: "Output format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
              default: "json",
            },
            endpoint: {
              type: "string",
              description: "Hub instance to query for charts (default: https://hub.helm.sh)",
            },
            failOnNoResult: {
              type: "boolean",
              description: "Search fails if no results are found",
              default: false,
            },
            listRepoUrl: {
              type: "boolean",
              description: "Print charts repository URL",
              default: false,
            },
            maxColWidth: {
              type: "number",
              description: "Maximum column width for output table (default: 50)",
            },
          },
          required: ["keyword"],
        },
      },
      handler: async ({
        keyword,
        source,
        maxResults,
        versions,
        devel,
        version,
        regexp,
        output,
        endpoint,
        failOnNoResult,
        listRepoUrl,
        maxColWidth,
      }: {
        keyword: string;
        source?: string;
        maxResults?: number;
        versions?: boolean;
        devel?: boolean;
        version?: string;
        regexp?: boolean;
        output?: string;
        endpoint?: string;
        failOnNoResult?: boolean;
        listRepoUrl?: boolean;
        maxColWidth?: number;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedKeyword = sanitizeShellArg(keyword);
          const args: string[] = ["search", source || "repo", sanitizedKeyword];
          if (maxResults && maxResults > 0) args.push("--max", String(maxResults));
          if (versions) args.push("--versions");
          if (devel) args.push("--devel");
          if (version) args.push("--version", sanitizeShellArg(version));
          if (regexp) args.push("--regexp");
          if (output) args.push("--output", sanitizeShellArg(output));
          if (endpoint) args.push("--endpoint", sanitizeShellArg(endpoint));
          if (failOnNoResult) args.push("--fail-on-no-result");
          if (listRepoUrl) args.push("--list-repo-url");
          if (maxColWidth !== undefined && maxColWidth >= 0) args.push("--max-col-width", String(maxColWidth));
          const results = parseHelmJson(args, 60000);
          return {
            results: results || [],
            count: results?.length || 0,
            source: source || "repo",
            keyword: sanitizedKeyword,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_search" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
