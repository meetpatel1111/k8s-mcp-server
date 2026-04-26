import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseInstallTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_install",
        description: "Install a Helm chart into Kubernetes",
        inputSchema: {
          type: "object",
          properties: {
            release: {
              type: "string",
              description: "Release name (optional for auto-generated)",
            },
            chart: {
              type: "string",
              description: "Chart reference (repo/chart, path, or URL)",
            },
            namespace: {
              type: "string",
              description: "Namespace to install into",
              default: "default",
            },
            version: {
              type: "string",
              description: "Chart version to install",
            },
            values: {
              type: "array",
              items: { type: "string" },
              description: "Path to values.yaml file or URL (can specify multiple)",
            },
            set: {
              type: "array",
              items: { type: "string" },
              description: "Set values on command line (key=value format)",
            },
            setFile: {
              type: "array",
              items: { type: "string" },
              description: "Set values from files (key=filepath format)",
            },
            setJson: {
              type: "array",
              items: { type: "string" },
              description: "Set JSON values on command line (key=jsonvalue format)",
            },
            setLiteral: {
              type: "array",
              items: { type: "string" },
              description: "Set literal STRING values on command line",
            },
            setString: {
              type: "array",
              items: { type: "string" },
              description: "Set STRING values on command line (key=value format)",
            },
            dryRun: {
              type: "string",
              description: "Simulate an install (none, client, or server)",
              enum: ["none", "client", "server"],
            },
            wait: {
              type: "boolean",
              description: "Wait until resources are ready",
              default: false,
            },
            timeout: {
              type: "string",
              description: "Time to wait (e.g., '5m', '300s')",
            },
            createNamespace: {
              type: "boolean",
              description: "Create the namespace if it doesn't exist",
              default: false,
            },
            noHooks: {
              type: "boolean",
              description: "Prevent hooks from running during install",
              default: false,
            },
            dependencyUpdate: {
              type: "boolean",
              description: "Update missing dependencies before installing",
              default: false,
            },
            description: {
              type: "string",
              description: "Add a custom description for the release",
            },
            devel: {
              type: "boolean",
              description: "Use development versions, too",
              default: false,
            },
            disableOpenapiValidation: {
              type: "boolean",
              description: "Don't validate rendered templates against Kubernetes OpenAPI Schema",
              default: false,
            },
            enableDns: {
              type: "boolean",
              description: "Enable DNS lookups when rendering templates",
              default: false,
            },
            forceConflicts: {
              type: "boolean",
              description: "Force server-side apply changes against conflicts",
              default: false,
            },
            forceReplace: {
              type: "boolean",
              description: "Force resource updates by replacement",
              default: false,
            },
            generateName: {
              type: "boolean",
              description: "Generate the name (and omit the NAME parameter)",
              default: false,
            },
            hideNotes: {
              type: "boolean",
              description: "Do not show notes in install output",
              default: false,
            },
            hideSecret: {
              type: "boolean",
              description: "Hide Kubernetes Secrets when using --dry-run",
              default: false,
            },
            labels: {
              type: "string",
              description: "Labels to add to release metadata (comma-separated key=value pairs)",
            },
            nameTemplate: {
              type: "string",
              description: "Specify template used to name the release",
            },
            output: {
              type: "string",
              description: "Prints the output in the specified format (table, json, yaml)",
              enum: ["table", "json", "yaml"],
            },
            postRenderer: {
              type: "string",
              description: "The name of a post-renderer type plugin to be used",
            },
            postRendererArgs: {
              type: "array",
              items: { type: "string" },
              description: "Arguments to the post-renderer",
            },
            renderSubchartNotes: {
              type: "boolean",
              description: "Render subchart notes along with the parent",
              default: false,
            },
            replace: {
              type: "boolean",
              description: "Reuse the given name, only if that name is a deleted release",
              default: false,
            },
            repo: {
              type: "string",
              description: "Chart repository URL where to locate the requested chart",
            },
            rollbackOnFailure: {
              type: "boolean",
              description: "Rollback (uninstall) the installation upon failure",
              default: false,
            },
            serverSide: {
              type: "boolean",
              description: "Object updates run in the server instead of the client",
              default: true,
            },
            skipCRDs: {
              type: "boolean",
              description: "Skip CRD installation",
              default: false,
            },
            skipSchemaValidation: {
              type: "boolean",
              description: "Disable JSON schema validation",
              default: false,
            },
            takeOwnership: {
              type: "boolean",
              description: "Ignore the check for helm annotations and take ownership of existing resources",
              default: false,
            },
            verify: {
              type: "boolean",
              description: "Verify the package before using it",
              default: false,
            },
            waitForJobs: {
              type: "boolean",
              description: "Wait until all Jobs have been completed",
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
            keyring: {
              type: "string",
              description: "Location of public keys used for verification",
            },
            passCredentials: {
              type: "boolean",
              description: "Pass credentials to all domains",
              default: false,
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
          required: ["chart"],
        },
      },
      handler: async ({
        release,
        chart,
        namespace,
        version,
        values,
        set,
        setFile,
        setJson,
        setLiteral,
        setString,
        dryRun,
        wait,
        timeout,
        createNamespace,
        noHooks,
        dependencyUpdate,
        description,
        devel,
        disableOpenapiValidation,
        enableDns,
        forceConflicts,
        forceReplace,
        generateName,
        hideNotes,
        hideSecret,
        labels,
        nameTemplate,
        output,
        postRenderer,
        postRendererArgs,
        renderSubchartNotes,
        replace,
        repo,
        rollbackOnFailure,
        serverSide,
        skipCRDs,
        skipSchemaValidation,
        takeOwnership,
        verify,
        waitForJobs,
        caFile,
        certFile,
        insecureSkipTlsVerify,
        keyFile,
        keyring,
        passCredentials,
        password,
        plainHttp,
        username,
      }: {
        release?: string;
        chart: string;
        namespace?: string;
        version?: string;
        values?: string[];
        set?: string[];
        setFile?: string[];
        setJson?: string[];
        setLiteral?: string[];
        setString?: string[];
        dryRun?: string;
        wait?: boolean;
        timeout?: string;
        createNamespace?: boolean;
        noHooks?: boolean;
        dependencyUpdate?: boolean;
        description?: string;
        devel?: boolean;
        disableOpenapiValidation?: boolean;
        enableDns?: boolean;
        forceConflicts?: boolean;
        forceReplace?: boolean;
        generateName?: boolean;
        hideNotes?: boolean;
        hideSecret?: boolean;
        labels?: string;
        nameTemplate?: string;
        output?: string;
        postRenderer?: string;
        postRendererArgs?: string[];
        renderSubchartNotes?: boolean;
        replace?: boolean;
        repo?: string;
        rollbackOnFailure?: boolean;
        serverSide?: boolean;
        skipCRDs?: boolean;
        skipSchemaValidation?: boolean;
        takeOwnership?: boolean;
        verify?: boolean;
        waitForJobs?: boolean;
        caFile?: string;
        certFile?: string;
        insecureSkipTlsVerify?: boolean;
        keyFile?: string;
        keyring?: string;
        passCredentials?: boolean;
        password?: string;
        plainHttp?: boolean;
        username?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["install"];
          if (release) {
            args.push(sanitizeHelmRelease(release));
          } else {
            args.push("--generate-name");
          }
          args.push(sanitizedChart, "-n", ns);
          if (version) args.push("--version", sanitizeShellArg(version));
          if (values) values.forEach(v => args.push("-f", sanitizeShellArg(v)));
          if (set) set.forEach(s => args.push("--set", sanitizeShellArg(s)));
          if (setFile) setFile.forEach(s => args.push("--set-file", sanitizeShellArg(s)));
          if (setJson) setJson.forEach(s => args.push("--set-json", sanitizeShellArg(s)));
          if (setLiteral) setLiteral.forEach(s => args.push("--set-literal", sanitizeShellArg(s)));
          if (setString) setString.forEach(s => args.push("--set-string", sanitizeShellArg(s)));
          if (dryRun) args.push("--dry-run", sanitizeShellArg(dryRun));
          if (wait) args.push("--wait");
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          if (createNamespace) args.push("--create-namespace");
          if (noHooks) args.push("--no-hooks");
          if (dependencyUpdate) args.push("--dependency-update");
          if (description) args.push("--description", sanitizeShellArg(description));
          if (devel) args.push("--devel");
          if (disableOpenapiValidation) args.push("--disable-openapi-validation");
          if (enableDns) args.push("--enable-dns");
          if (forceConflicts) args.push("--force-conflicts");
          if (forceReplace) args.push("--force-replace");
          if (generateName) args.push("--generate-name");
          if (hideNotes) args.push("--hide-notes");
          if (hideSecret) args.push("--hide-secret");
          if (labels) args.push("--labels", sanitizeShellArg(labels));
          if (nameTemplate) args.push("--name-template", sanitizeShellArg(nameTemplate));
          if (output) args.push("--output", sanitizeShellArg(output));
          if (postRenderer) args.push("--post-renderer", sanitizeShellArg(postRenderer));
          if (postRendererArgs) postRendererArgs.forEach(a => args.push("--post-renderer-args", sanitizeShellArg(a)));
          if (renderSubchartNotes) args.push("--render-subchart-notes");
          if (replace) args.push("--replace");
          if (repo) args.push("--repo", sanitizeShellArg(repo));
          if (rollbackOnFailure) args.push("--rollback-on-failure");
          if (serverSide === false) args.push("--server-side=false");
          if (skipCRDs) args.push("--skip-crds");
          if (skipSchemaValidation) args.push("--skip-schema-validation");
          if (takeOwnership) args.push("--take-ownership");
          if (verify) args.push("--verify");
          if (waitForJobs) args.push("--wait-for-jobs");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (passCredentials) args.push("--pass-credentials");
          if (password) args.push("--password", sanitizeShellArg(password));
          if (plainHttp) args.push("--plain-http");
          if (username) args.push("--username", sanitizeShellArg(username));
          const outputResult = runHelm(args, 120000);
          return {
            success: true,
            release: release || "auto-generated",
            namespace: ns,
            chart: sanitizedChart,
            output: outputResult,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_install", resource: chart, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
