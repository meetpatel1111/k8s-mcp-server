import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";

export function registerHelmRegistryManagementTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_registry_login",
        description: "Login to an OCI registry for Helm charts",
        inputSchema: {
          type: "object",
          properties: {
            host: {
              type: "string",
              description: "Registry host to login to (e.g., registry.example.com)",
            },
            username: {
              type: "string",
              description: "Registry username",
            },
            password: {
              type: "string",
              description: "Registry password or token",
            },
            insecure: {
              type: "boolean",
              description: "Allow connections to TLS registry without certs",
              default: false,
            },
            caFile: {
              type: "string",
              description: "Verify certificates of HTTPS-enabled servers using this CA bundle",
            },
            certFile: {
              type: "string",
              description: "Identify registry client using this SSL certificate file",
            },
            keyFile: {
              type: "string",
              description: "Identify registry client using this SSL key file",
            },
            plainHttp: {
              type: "boolean",
              description: "Use insecure HTTP connections for chart upload",
              default: false,
            },
          },
          required: ["host"],
        },
      },
      handler: async ({ host, username, password, insecure, caFile, certFile, keyFile, plainHttp }: {
        host: string;
        username?: string;
        password?: string;
        insecure?: boolean;
        caFile?: string;
        certFile?: string;
        keyFile?: string;
        plainHttp?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedHost = sanitizeShellArg(host);
          const args: string[] = ["registry", "login", sanitizedHost];
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (insecure) args.push("--insecure");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (plainHttp) args.push("--plain-http");
          const output = runHelm(args, 30000);
          return {
            success: true,
            host: sanitizedHost,
            username,
            output,
            message: `Logged in to registry: ${sanitizedHost}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_registry_login", resource: host };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_registry_logout",
        description: "Logout from an OCI registry",
        inputSchema: {
          type: "object",
          properties: {
            host: {
              type: "string",
              description: "Registry host to logout from",
            },
          },
          required: ["host"],
        },
      },
      handler: async ({ host }: { host: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedHost = sanitizeShellArg(host);
          const output = runHelm(["registry", "logout", sanitizedHost]);
          return {
            success: true,
            host: sanitizedHost,
            output,
            message: `Logged out from registry: ${sanitizedHost}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_registry_logout", resource: host };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_push",
        description: "Push a chart to an OCI registry or remote URL",
        inputSchema: {
          type: "object",
          properties: {
            chart: {
              type: "string",
              description: "Chart path or .tgz file to push",
            },
            remote: {
              type: "string",
              description: "Remote URL or registry reference (e.g., oci://registry.example.com/charts)",
            },
            insecureSkipTlsVerify: {
              type: "boolean",
              description: "Skip TLS certificate checks for the chart upload",
              default: false,
            },
            caFile: {
              type: "string",
              description: "Verify certificates of HTTPS-enabled servers using this CA bundle",
            },
            certFile: {
              type: "string",
              description: "Identify registry client using this SSL certificate file",
            },
            keyFile: {
              type: "string",
              description: "Identify registry client using this SSL key file",
            },
            username: {
              type: "string",
              description: "Chart repository username where to locate the requested chart",
            },
            password: {
              type: "string",
              description: "Chart repository password where to locate the requested chart",
            },
            plainHttp: {
              type: "boolean",
              description: "Use insecure HTTP connections for the chart upload",
              default: false,
            },
          },
          required: ["chart", "remote"],
        },
      },
      handler: async ({ chart, remote, insecureSkipTlsVerify, caFile, certFile, keyFile, username, password, plainHttp }: {
        chart: string;
        remote: string;
        insecureSkipTlsVerify?: boolean;
        caFile?: string;
        certFile?: string;
        keyFile?: string;
        username?: string;
        password?: string;
        plainHttp?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const sanitizedRemote = sanitizeShellArg(remote);
          const args: string[] = ["push", sanitizedChart, sanitizedRemote];
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (plainHttp) args.push("--plain-http");
          const output = runHelm(args, 120000);
          return {
            success: true,
            chart: sanitizedChart,
            remote: sanitizedRemote,
            output,
            message: `Chart pushed to: ${sanitizedRemote}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_push", resource: chart };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
