import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, sanitizeHelmRelease, helmUnavailableResponse } from "./common.js";

export function registerHelmReleaseUpgradeTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_upgrade",
        description: "Upgrade a Helm release to a new version of a chart",
        inputSchema: {
          type: "object",
          properties: {
            release: {
              type: "string",
              description: "Release name",
            },
            chart: {
              type: "string",
              description: "Chart reference",
            },
            namespace: {
              type: "string",
              description: "Release namespace",
              default: "default",
            },
            version: {
              type: "string",
              description: "Chart version",
            },
            values: {
              type: "string",
              description: "Values file path",
            },
            set: {
              type: "array",
              items: { type: "string" },
              description: "Set values (key=value)",
            },
            dryRun: {
              type: "boolean",
              description: "Simulate an upgrade",
              default: false,
            },
            install: {
              type: "boolean",
              description: "Install if release doesn't exist (helm upgrade --install)",
              default: false,
            },
            wait: {
              type: "boolean",
              description: "Wait until resources are ready",
              default: false,
            },
            timeout: {
              type: "string",
              description: "Time to wait (e.g., '5m')",
            },
            force: {
              type: "boolean",
              description: "Force resource updates through deletion/recreate",
              default: false,
            },
            resetValues: {
              type: "boolean",
              description: "Reset values to built-in defaults",
              default: false,
            },
            reuseValues: {
              type: "boolean",
              description: "Reuse previous values",
              default: false,
            },
            rollbackOnFailure: {
              type: "boolean",
              description: "Rollback on failed upgrade",
              default: false,
            },
            noHooks: {
              type: "boolean",
              description: "Prevent hooks from running during upgrade",
              default: false,
            },
            dependencyUpdate: {
              type: "boolean",
              description: "Update missing dependencies before upgrading",
              default: false,
            },
            atomic: {
              type: "boolean",
              description: "Rollback on failure (atomic upgrade)",
              default: false,
            },
            description: {
              type: "string",
              description: "Add a custom description for the release",
            },
            disableOpenapiValidation: {
              type: "boolean",
              description: "Don't validate rendered templates against Kubernetes OpenAPI Schema",
              default: false,
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
            createNamespace: {
              type: "boolean",
              description: "Create the release namespace if not present (with --install)",
              default: false,
            },
            historyMax: {
              type: "number",
              description: "Maximum number of revisions saved per release (0=no limit)",
            },
            cleanupOnFail: {
              type: "boolean",
              description: "Allow deletion of new resources created when upgrade fails",
              default: false,
            },
            keyring: {
              type: "string",
              description: "Location of public keys for verification (default: ~/.gnupg/pubring.gpg)",
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
            hideSecret: {
              type: "boolean",
              description: "Hide Kubernetes Secrets when using --dry-run",
              default: false,
            },
            setFile: {
              type: "array",
              items: { type: "string" },
              description: "Set values from files (key=filepath)",
            },
            setJson: {
              type: "array",
              items: { type: "string" },
              description: "Set JSON values on command line (key=jsonvalue)",
            },
            setLiteral: {
              type: "array",
              items: { type: "string" },
              description: "Set literal STRING values on command line",
            },
            setString: {
              type: "array",
              items: { type: "string" },
              description: "Set STRING values on command line (key=value)",
            },
          },
          required: ["release", "chart"],
        },
      },
      handler: async ({
        release,
        chart,
        namespace,
        version,
        values,
        set,
        dryRun,
        install,
        wait,
        timeout,
        force,
        resetValues,
        reuseValues,
        rollbackOnFailure,
        noHooks,
        dependencyUpdate,
        atomic,
        description,
        disableOpenapiValidation,
        skipCRDs,
        skipSchemaValidation,
        verify,
        waitForJobs,
        createNamespace,
        historyMax,
        cleanupOnFail,
        keyring,
        repo,
        username,
        password,
        devel,
        hideSecret,
        setFile,
        setJson,
        setLiteral,
        setString,
      }: {
        release: string;
        chart: string;
        namespace?: string;
        version?: string;
        values?: string;
        set?: string[];
        dryRun?: boolean;
        install?: boolean;
        wait?: boolean;
        timeout?: string;
        force?: boolean;
        resetValues?: boolean;
        reuseValues?: boolean;
        rollbackOnFailure?: boolean;
        noHooks?: boolean;
        dependencyUpdate?: boolean;
        atomic?: boolean;
        description?: string;
        disableOpenapiValidation?: boolean;
        skipCRDs?: boolean;
        skipSchemaValidation?: boolean;
        verify?: boolean;
        waitForJobs?: boolean;
        createNamespace?: boolean;
        historyMax?: number;
        cleanupOnFail?: boolean;
        keyring?: string;
        repo?: string;
        username?: string;
        password?: string;
        devel?: boolean;
        hideSecret?: boolean;
        setFile?: string[];
        setJson?: string[];
        setLiteral?: string[];
        setString?: string[];
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedRelease = sanitizeHelmRelease(release);
          const sanitizedChart = sanitizeShellArg(chart);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["upgrade", sanitizedRelease, sanitizedChart, "-n", ns];
          if (version) args.push("--version", sanitizeShellArg(version));
          if (values) args.push("-f", sanitizeShellArg(values));
          if (set) set.forEach(s => args.push("--set", sanitizeShellArg(s)));
          if (dryRun) args.push("--dry-run");
          if (install) args.push("--install");
          if (wait) args.push("--wait");
          if (timeout) args.push("--timeout", sanitizeShellArg(timeout));
          if (force) args.push("--force");
          if (resetValues) args.push("--reset-values");
          if (reuseValues) args.push("--reuse-values");
          if (rollbackOnFailure) args.push("--rollback-on-failure");
          if (noHooks) args.push("--no-hooks");
          if (dependencyUpdate) args.push("--dependency-update");
          if (atomic) args.push("--atomic");
          if (description) args.push("--description", sanitizeShellArg(description));
          if (disableOpenapiValidation) args.push("--disable-openapi-validation");
          if (skipCRDs) args.push("--skip-crds");
          if (skipSchemaValidation) args.push("--skip-schema-validation");
          if (verify) args.push("--verify");
          if (waitForJobs) args.push("--wait-for-jobs");
          if (createNamespace) args.push("--create-namespace");
          if (historyMax !== undefined && historyMax >= 0) args.push("--history-max", String(historyMax));
          if (cleanupOnFail) args.push("--cleanup-on-fail");
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (repo) args.push("--repo", sanitizeShellArg(repo));
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (devel) args.push("--devel");
          if (hideSecret) args.push("--hide-secret");
          if (setFile) setFile.forEach(s => args.push("--set-file", sanitizeShellArg(s)));
          if (setJson) setJson.forEach(s => args.push("--set-json", sanitizeShellArg(s)));
          if (setLiteral) setLiteral.forEach(s => args.push("--set-literal", sanitizeShellArg(s)));
          if (setString) setString.forEach(s => args.push("--set-string", sanitizeShellArg(s)));
          const output = runHelm(args, 120000);
          return {
            success: true,
            release: sanitizedRelease,
            namespace: ns,
            chart: sanitizedChart,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_upgrade", resource: `${release}/${chart}`, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
