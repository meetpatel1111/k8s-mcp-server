import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, parseHelmJson, helmUnavailableResponse } from "./common.js";

export function registerHelmRepoManagementTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_repo_list",
        description: "List configured Helm chart repositories (like helm repo list)",
        inputSchema: {
          type: "object",
          properties: {
            noHeaders: {
              type: "boolean",
              description: "Suppress headers in the output",
              default: false,
            },
            output: {
              type: "string",
              description: "Output format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
              default: "json",
            },
          },
        },
      },
      handler: async ({ noHeaders, output }: { noHeaders?: boolean; output?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["repo", "list"];
          if (noHeaders) args.push("--no-headers");
          if (output) args.push("--output", sanitizeShellArg(output));
          const repos = parseHelmJson(args);
          return {
            repositories: repos || [],
            count: repos?.length || 0,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_repo_list" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_repo_add",
        description: "Add a Helm chart repository",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Repository name",
            },
            url: {
              type: "string",
              description: "Repository URL",
            },
            username: {
              type: "string",
              description: "Chart repository username",
            },
            password: {
              type: "string",
              description: "Chart repository password",
            },
            allowDeprecatedRepos: {
              type: "boolean",
              description: "Allow adding deprecated official repos",
              default: false,
            },
            caFile: {
              type: "string",
              description: "Verify certificates of HTTPS-enabled servers using this CA bundle",
            },
            certFile: {
              type: "string",
              description: "Identify HTTPS client using this SSL certificate file",
            },
            forceUpdate: {
              type: "boolean",
              description: "Replace (overwrite) the repo if it already exists",
              default: false,
            },
            insecureSkipTlsVerify: {
              type: "boolean",
              description: "Skip TLS certificate checks for the repository",
              default: false,
            },
            keyFile: {
              type: "string",
              description: "Identify HTTPS client using this SSL key file",
            },
            passCredentials: {
              type: "boolean",
              description: "Pass credentials to all domains",
              default: false,
            },
            timeout: {
              type: "string",
              description: "Time to wait for index file download (default: 2m0s)",
            },
          },
          required: ["name", "url"],
        },
      },
      handler: async ({ name, url, username, password, allowDeprecatedRepos, caFile, certFile, forceUpdate, insecureSkipTlsVerify, keyFile, passCredentials, timeout }: {
        name: string;
        url: string;
        username?: string;
        password?: string;
        allowDeprecatedRepos?: boolean;
        caFile?: string;
        certFile?: string;
        forceUpdate?: boolean;
        insecureSkipTlsVerify?: boolean;
        keyFile?: string;
        passCredentials?: boolean;
        timeout?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedName = sanitizeShellArg(name);
          const sanitizedUrl = sanitizeShellArg(url);
          const args: string[] = ["repo", "add", sanitizedName, sanitizedUrl];
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (allowDeprecatedRepos) args.push("--allow-deprecated-repos");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (forceUpdate) args.push("--force-update");
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (passCredentials) args.push("--pass-credentials");
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          const output = runHelm(args);
          return {
            success: true,
            name: sanitizedName,
            url: sanitizedUrl,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_repo_add" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_repo_remove",
        description: "Remove a Helm chart repository",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Repository name",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name }: { name: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedName = sanitizeShellArg(name);
          const output = runHelm(["repo", "remove", sanitizedName]);
          return {
            success: true,
            name: sanitizedName,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_repo_remove" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_repo_update",
        description: "Update Helm chart repositories (get latest charts)",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Specific repo to update (default: all)",
            },
            timeout: {
              type: "string",
              description: "Time to wait for index file download (default: 2m0s)",
            },
          },
        },
      },
      handler: async ({ repo, timeout }: { repo?: string; timeout?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["repo", "update"];
          if (repo) args.push(sanitizeShellArg(repo));
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          const output = runHelm(args, 60000);
          return {
            success: true,
            updated: repo || "all repositories",
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_repo_update" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_repo_index",
        description: "Generate an index file given a directory containing packaged charts",
        inputSchema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory containing packaged charts",
            },
            url: {
              type: "string",
              description: "URL to prepend to each chart URL",
            },
            merge: {
              type: "string",
              description: "Merge the generated index with an existing index file",
            },
            json: {
              type: "boolean",
              description: "Output in JSON format",
              default: false,
            },
          },
          required: ["directory"],
        },
      },
      handler: async ({ directory, url, merge, json }: {
        directory: string;
        url?: string;
        merge?: string;
        json?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedDir = sanitizeShellArg(directory);
          const args: string[] = ["repo", "index", sanitizedDir];
          if (url) args.push("--url", sanitizeShellArg(url));
          if (merge) args.push("--merge", sanitizeShellArg(merge));
          if (json) args.push("--json");
          const output = runHelm(args);
          return {
            success: true,
            directory: sanitizedDir,
            url,
            output,
            indexFile: `${sanitizedDir}/index.yaml`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_repo_index", resource: directory };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
