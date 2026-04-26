import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";

export function registerHelmShowChartTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_show",
        description: "Show information about a Helm chart (like helm show chart/values/readme)",
        inputSchema: {
          type: "object",
          properties: {
            chart: {
              type: "string",
              description: "Chart reference (repo/chart or path)",
            },
            info: {
              type: "string",
              description: "Type of information to show",
              enum: ["chart", "values", "readme", "all", "crds"],
              default: "chart",
            },
            version: {
              type: "string",
              description: "Chart version",
            },
            jsonpath: {
              type: "string",
              description: "JSONPath expression to filter the output (for values only)",
            },
            repo: {
              type: "string",
              description: "Chart repository URL where to locate the requested chart",
            },
            username: {
              type: "string",
              description: "Chart repository username",
            },
            password: {
              type: "string",
              description: "Chart repository password",
            },
            devel: {
              type: "boolean",
              description: "Use development versions too",
              default: false,
            },
            verify: {
              type: "boolean",
              description: "Verify the package before using it",
              default: false,
            },
            keyring: {
              type: "string",
              description: "Location of public keys for verification (default: ~/.gnupg/pubring.gpg)",
            },
            caFile: {
              type: "string",
              description: "Verify certificates of HTTPS-enabled servers using this CA bundle",
            },
            certFile: {
              type: "string",
              description: "Identify HTTPS client using this SSL certificate file",
            },
            keyFile: {
              type: "string",
              description: "Identify HTTPS client using this SSL key file",
            },
            insecureSkipTlsVerify: {
              type: "boolean",
              description: "Skip TLS certificate checks for the chart download",
              default: false,
            },
            passCredentials: {
              type: "boolean",
              description: "Pass credentials to all domains",
              default: false,
            },
            plainHttp: {
              type: "boolean",
              description: "Use insecure HTTP connections for the chart download",
              default: false,
            },
          },
          required: ["chart"],
        },
      },
      handler: async ({
        chart,
        info,
        version,
        jsonpath,
        repo,
        username,
        password,
        devel,
        verify,
        keyring,
        caFile,
        certFile,
        keyFile,
        insecureSkipTlsVerify,
        passCredentials,
        plainHttp,
      }: {
        chart: string;
        info?: string;
        version?: string;
        jsonpath?: string;
        repo?: string;
        username?: string;
        password?: string;
        devel?: boolean;
        verify?: boolean;
        keyring?: string;
        caFile?: string;
        certFile?: string;
        keyFile?: string;
        insecureSkipTlsVerify?: boolean;
        passCredentials?: boolean;
        plainHttp?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const args: string[] = ["show", info || "chart", sanitizedChart];
          if (version) args.push("--version", sanitizeShellArg(version));
          if (jsonpath && (info === "values" || !info)) args.push("--jsonpath", sanitizeShellArg(jsonpath));
          if (repo) args.push("--repo", sanitizeShellArg(repo));
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (devel) args.push("--devel");
          if (verify) args.push("--verify");
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (passCredentials) args.push("--pass-credentials");
          if (plainHttp) args.push("--plain-http");
          const output = runHelm(args, 60000);
          return {
            chart: sanitizedChart,
            info: info || "chart",
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_show", resource: chart };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
