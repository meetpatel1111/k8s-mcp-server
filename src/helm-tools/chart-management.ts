import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { validateResourceName } from "../validators.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";
import { homedir, tmpdir } from "os";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export function registerHelmChartManagementTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_create",
        description: "Create a new Helm chart directory with common files and directories",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the chart to create",
            },
            starter: {
              type: "string",
              description: "The name or absolute path to the Helm chart starter scaffold",
            },
          },
          required: ["name"],
        },
      },
      handler: async ({ name, starter }: { name: string; starter?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedName = sanitizeShellArg(name);
          validateResourceName(sanitizedName, "chart");
          const args: string[] = ["create", sanitizedName];
          if (starter) args.push("--starter", sanitizeShellArg(starter));
          const output = runHelm(args);
          return {
            success: true,
            message: `Chart '${sanitizedName}' created successfully`,
            output,
            location: `./${sanitizedName}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_create", resource: name };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_package",
        description: "Package a Helm chart into a versioned chart archive file",
        inputSchema: {
          type: "object",
          properties: {
            chartPath: {
              type: "string",
              description: "Path to the chart directory",
            },
            destination: {
              type: "string",
              description: "Location to write the chart package (default: current directory)",
            },
            sign: {
              type: "boolean",
              description: "Use a PGP private key to sign the package",
              default: false,
            },
            key: {
              type: "string",
              description: "Name of the key to use for signing",
            },
            keyring: {
              type: "string",
              description: "Location of a public keyring for signing (default: ~/.gnupg/pubring.gpg)",
            },
            passphraseFile: {
              type: "string",
              description: "Location of a file containing passphrase for signing key",
            },
            appVersion: {
              type: "string",
              description: "Set the appVersion on the chart to this version",
            },
            version: {
              type: "string",
              description: "Set the version on the chart to this semver version",
            },
            dependencyUpdate: {
              type: "boolean",
              description: "Update dependencies from Chart.yaml to dir charts/ before packaging",
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
            insecureSkipTlsVerify: {
              type: "boolean",
              description: "Skip TLS certificate checks for the chart download",
              default: false,
            },
            keyFile: {
              type: "string",
              description: "Identify HTTPS client using this SSL key file",
            },
            password: {
              type: "string",
              description: "Chart repository password where to locate the requested chart",
            },
            plainHttp: {
              type: "boolean",
              description: "Use insecure HTTP connections for the chart download",
              default: false,
            },
            username: {
              type: "string",
              description: "Chart repository username where to locate the requested chart",
            },
          },
          required: ["chartPath"],
        },
      },
      handler: async ({ chartPath, destination, sign, key, keyring, passphraseFile, appVersion, version, dependencyUpdate, caFile, certFile, insecureSkipTlsVerify, keyFile, password, plainHttp, username }: {
        chartPath: string;
        destination?: string;
        sign?: boolean;
        key?: string;
        keyring?: string;
        passphraseFile?: string;
        appVersion?: string;
        version?: string;
        dependencyUpdate?: boolean;
        caFile?: string;
        certFile?: string;
        insecureSkipTlsVerify?: boolean;
        keyFile?: string;
        password?: string;
        plainHttp?: boolean;
        username?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedPath = sanitizeShellArg(chartPath);
          const args: string[] = ["package", sanitizedPath];
          if (destination) args.push("-d", sanitizeShellArg(destination));
          if (sign) args.push("--sign");
          if (key) args.push("--key", sanitizeShellArg(key));
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (passphraseFile) args.push("--passphrase-file", sanitizeShellArg(passphraseFile));
          if (appVersion) args.push("--app-version", sanitizeShellArg(appVersion));
          if (version) args.push("--version", sanitizeShellArg(version));
          if (dependencyUpdate) args.push("--dependency-update");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (plainHttp) args.push("--plain-http");
          if (username) args.push("--username", sanitizeShellArg(username));
          const output = runHelm(args, 60000);
          return {
            success: true,
            message: "Chart packaged successfully",
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_package", resource: chartPath };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_lint",
        description: "Run tests to examine a Helm chart and identify possible issues",
        inputSchema: {
          type: "object",
          properties: {
            chart: {
              type: "string",
              description: "Chart path or reference to lint",
            },
            strict: {
              type: "boolean",
              description: "Fail on lint warnings",
              default: false,
            },
            quiet: {
              type: "boolean",
              description: "Print only warnings and errors",
              default: false,
            },
            kubeVersion: {
              type: "string",
              description: "Kubernetes version used for capabilities and deprecation checks",
            },
            set: {
              type: "array",
              items: { type: "string" },
              description: "Set values on the command line (key=value format)",
            },
            setFile: {
              type: "array",
              items: { type: "string" },
              description: "Set values from files (key=filepath format)",
            },
            setJson: {
              type: "array",
              items: { type: "string" },
              description: "Set JSON values on the command line (key=jsonvalue format)",
            },
            setLiteral: {
              type: "array",
              items: { type: "string" },
              description: "Set literal STRING values on the command line",
            },
            setString: {
              type: "array",
              items: { type: "string" },
              description: "Set STRING values on the command line (key=value format)",
            },
            skipSchemaValidation: {
              type: "boolean",
              description: "Disable JSON schema validation",
              default: false,
            },
            values: {
              type: "string",
              description: "Path to values.yaml file or URL",
            },
            withSubcharts: {
              type: "boolean",
              description: "Lint dependent charts too",
              default: false,
            },
          },
          required: ["chart"],
        },
      },
      handler: async ({ chart, strict, quiet, kubeVersion, set, setFile, setJson, setLiteral, setString, skipSchemaValidation, values, withSubcharts }: {
        chart: string;
        strict?: boolean;
        quiet?: boolean;
        kubeVersion?: string;
        set?: string[];
        setFile?: string[];
        setJson?: string[];
        setLiteral?: string[];
        setString?: string[];
        skipSchemaValidation?: boolean;
        values?: string;
        withSubcharts?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const args: string[] = ["lint", sanitizedChart];
          if (strict) args.push("--strict");
          if (quiet) args.push("--quiet");
          if (kubeVersion) args.push("--kube-version", sanitizeShellArg(kubeVersion));
          if (set) set.forEach(s => args.push("--set", sanitizeShellArg(s)));
          if (setFile) setFile.forEach(s => args.push("--set-file", sanitizeShellArg(s)));
          if (setJson) setJson.forEach(s => args.push("--set-json", sanitizeShellArg(s)));
          if (setLiteral) setLiteral.forEach(s => args.push("--set-literal", sanitizeShellArg(s)));
          if (setString) setString.forEach(s => args.push("--set-string", sanitizeShellArg(s)));
          if (skipSchemaValidation) args.push("--skip-schema-validation");
          if (values) args.push("-f", sanitizeShellArg(values));
          if (withSubcharts) args.push("--with-subcharts");
          const output = runHelm(args);
          return {
            success: true,
            chart: sanitizedChart,
            output,
            message: "Linting completed",
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_lint", resource: chart };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_pull",
        description: "Download/pull a Helm chart from a repository",
        inputSchema: {
          type: "object",
          properties: {
            chart: {
              type: "string",
              description: "Chart reference (e.g., 'bitnami/nginx')",
            },
            version: {
              type: "string",
              description: "Chart version to download (default: latest)",
            },
            untar: {
              type: "boolean",
              description: "Untar the chart after downloading",
              default: false,
            },
            destination: {
              type: "string",
              description: "Location to write the chart (default: ~/helm-charts or system temp)",
            },
            verify: {
              type: "boolean",
              description: "Verify the package before using it",
              default: false,
            },
            devel: {
              type: "boolean",
              description: "Use development versions (equivalent to version '>0.0.0-0')",
              default: false,
            },
            prov: {
              type: "boolean",
              description: "Fetch the provenance file, but don't perform verification",
              default: false,
            },
            untardir: {
              type: "string",
              description: "Directory name into which the chart is expanded (if untar is specified)",
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
            keyring: {
              type: "string",
              description: "Location of public keys used for verification",
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
      handler: async ({ chart, version, untar, destination, verify, devel, prov, untardir, repo, username, password, caFile, certFile, keyFile, keyring, insecureSkipTlsVerify, passCredentials, plainHttp }: {
        chart: string;
        version?: string;
        untar?: boolean;
        destination?: string;
        verify?: boolean;
        devel?: boolean;
        prov?: boolean;
        untardir?: string;
        repo?: string;
        username?: string;
        password?: string;
        caFile?: string;
        certFile?: string;
        keyFile?: string;
        keyring?: string;
        insecureSkipTlsVerify?: boolean;
        passCredentials?: boolean;
        plainHttp?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          
          // Use user-friendly default destination
          let destDir = destination;
          if (!destDir) {
            // Try ~/helm-charts first, fallback to temp
            const userChartsDir = join(homedir(), "helm-charts");
            destDir = userChartsDir;
          }
          
          // Ensure destination directory exists
          if (!existsSync(destDir)) {
            try {
              mkdirSync(destDir, { recursive: true });
            } catch (mkdirError) {
              // Fallback to temp if user dir creation fails
              destDir = tmpdir();
            }
          }
          
          const args: string[] = ["pull", sanitizedChart];
          if (version) args.push("--version", sanitizeShellArg(version));
          if (untar) args.push("--untar");
          args.push("-d", sanitizeShellArg(destDir));
          if (verify) args.push("--verify");
          if (devel) args.push("--devel");
          if (prov) args.push("--prov");
          if (untardir) args.push("--untardir", sanitizeShellArg(untardir));
          if (repo) args.push("--repo", sanitizeShellArg(repo));
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (passCredentials) args.push("--pass-credentials");
          if (plainHttp) args.push("--plain-http");
          const output = runHelm(args, 60000);
          return {
            success: true,
            chart: sanitizedChart,
            destination: destDir,
            output,
            message: untar ? `Chart pulled and extracted to ${destDir}` : `Chart pulled to ${destDir}`,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_pull", resource: chart };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_verify",
        description: "Verify that a chart has been signed and is valid",
        inputSchema: {
          type: "object",
          properties: {
            chartPath: {
              type: "string",
              description: "Path to the chart package (.tgz)",
            },
            keyring: {
              type: "string",
              description: "Path to public keys used for verification",
            },
          },
          required: ["chartPath"],
        },
      },
      handler: async ({ chartPath, keyring }: { chartPath: string; keyring?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedPath = sanitizeShellArg(chartPath);
          const args: string[] = ["verify", sanitizedPath];
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          const output = runHelm(args);
          return {
            success: true,
            chartPath: sanitizedPath,
            verified: true,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_verify", resource: chartPath };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions, verified: false };
        }
      },
    },
  ];
}
