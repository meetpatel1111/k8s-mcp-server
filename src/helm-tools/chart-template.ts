import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { scrubSensitiveData } from "../utils/secret-scrubber.js";
import { isHelmInstalled, runHelm, sanitizeHelmNamespace, helmUnavailableResponse } from "./common.js";

export function registerHelmChartTemplateTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_template",
        description: "Locally render templates for a Helm chart without installing",
        inputSchema: {
          type: "object",
          properties: {
            chart: {
              type: "string",
              description: "Chart reference (repo/chart, path, or URL)",
            },
            release: {
              type: "string",
              description: "Release name for template rendering",
            },
            namespace: {
              type: "string",
              description: "Namespace for template rendering",
              default: "default",
            },
            version: {
              type: "string",
              description: "Chart version",
            },
            values: {
              type: "string",
              description: "Path to values.yaml file",
            },
            set: {
              type: "array",
              items: { type: "string" },
              description: "Set values (key=value)",
            },
            includeCRDs: {
              type: "boolean",
              description: "Include CRDs in the templated output",
              default: false,
            },
            skipTests: {
              type: "boolean",
              description: "Skip tests from templated output",
              default: false,
            },
            validate: {
              type: "boolean",
              description: "Validate your manifests against the Kubernetes cluster",
              default: false,
            },
            noHooks: {
              type: "boolean",
              description: "Prevent hooks from running during template rendering",
              default: false,
            },
            kubeVersion: {
              type: "string",
              description: "Kubernetes version used for capabilities and deprecation checks",
            },
            apiVersions: {
              type: "array",
              items: { type: "string" },
              description: "Kubernetes API versions used for capabilities check",
            },
            skipSchemaValidation: {
              type: "boolean",
              description: "Skip JSON schema validation",
              default: false,
            },
            description: {
              type: "string",
              description: "Add a custom description for the release",
            },
            createNamespace: {
              type: "boolean",
              description: "Create the release namespace if not present",
              default: false,
            },
            dependencyUpdate: {
              type: "boolean",
              description: "Update dependencies if they are missing before rendering",
              default: false,
            },
            devel: {
              type: "boolean",
              description: "Use development versions too",
              default: false,
            },
            disableOpenapiValidation: {
              type: "boolean",
              description: "Don't validate rendered templates against Kubernetes OpenAPI Schema",
              default: false,
            },
            isUpgrade: {
              type: "boolean",
              description: "Set .Release.IsUpgrade instead of .Release.IsInstall",
              default: false,
            },
            labels: {
              type: "string",
              description: "Labels added to release metadata (comma-separated key=value)",
            },
            outputDir: {
              type: "string",
              description: "Write templates to files in this directory instead of stdout",
            },
            repo: {
              type: "string",
              description: "Chart repository URL where to locate the requested chart",
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
            showOnly: {
              type: "array",
              items: { type: "string" },
              description: "Only show manifests rendered from the given template files",
            },
            skipCRDs: {
              type: "boolean",
              description: "Skip CRD installation",
              default: false,
            },
            username: {
              type: "string",
              description: "Chart repository username",
            },
            password: {
              type: "string",
              description: "Chart repository password",
            },
            keyring: {
              type: "string",
              description: "Location of public keys for verification (default: ~/.gnupg/pubring.gpg)",
            },
            verify: {
              type: "boolean",
              description: "Verify the package before using it",
              default: false,
            },
            scrub: {
              type: "boolean",
              description: "Mask potential secrets in rendered templates (passwords, tokens, emails, IPs)",
              default: false,
            },
          },
          required: ["chart"],
        },
      },
      handler: async ({
        chart,
        release,
        namespace,
        version,
        values,
        set,
        includeCRDs,
        skipTests,
        validate,
        noHooks,
        kubeVersion,
        apiVersions,
        skipSchemaValidation,
        description,
        createNamespace,
        dependencyUpdate,
        devel,
        disableOpenapiValidation,
        isUpgrade,
        labels,
        outputDir,
        repo,
        setFile,
        setJson,
        setLiteral,
        setString,
        showOnly,
        skipCRDs,
        username,
        password,
        keyring,
        verify,
        scrub,
      }: {
        chart: string;
        release?: string;
        namespace?: string;
        version?: string;
        values?: string;
        set?: string[];
        includeCRDs?: boolean;
        skipTests?: boolean;
        validate?: boolean;
        noHooks?: boolean;
        kubeVersion?: string;
        apiVersions?: string[];
        skipSchemaValidation?: boolean;
        description?: string;
        createNamespace?: boolean;
        dependencyUpdate?: boolean;
        devel?: boolean;
        disableOpenapiValidation?: boolean;
        isUpgrade?: boolean;
        labels?: string;
        outputDir?: string;
        repo?: string;
        setFile?: string[];
        setJson?: string[];
        setLiteral?: string[];
        setString?: string[];
        showOnly?: string[];
        skipCRDs?: boolean;
        username?: string;
        password?: string;
        keyring?: string;
        verify?: boolean;
        scrub?: boolean;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedChart = sanitizeShellArg(chart);
          const ns = sanitizeHelmNamespace(namespace);
          const args: string[] = ["template"];
          if (release) args.push(sanitizeShellArg(release));
          args.push(sanitizedChart, "-n", ns);
          if (version) args.push("--version", sanitizeShellArg(version));
          if (values) args.push("-f", sanitizeShellArg(values));
          if (set) set.forEach(s => args.push("--set", sanitizeShellArg(s)));
          if (includeCRDs) args.push("--include-crds");
          if (noHooks) args.push("--no-hooks");
          if (kubeVersion) args.push("--kube-version", sanitizeShellArg(kubeVersion));
          if (apiVersions) apiVersions.forEach(v => args.push("--api-versions", sanitizeShellArg(v)));
          if (skipSchemaValidation) args.push("--skip-schema-validation");
          if (description) args.push("--description", sanitizeShellArg(description));
          if (skipTests) args.push("--skip-tests");
          if (validate) args.push("--validate");
          if (createNamespace) args.push("--create-namespace");
          if (dependencyUpdate) args.push("--dependency-update");
          if (devel) args.push("--devel");
          if (disableOpenapiValidation) args.push("--disable-openapi-validation");
          if (isUpgrade) args.push("--is-upgrade");
          if (labels) args.push("--labels", sanitizeShellArg(labels));
          if (outputDir) args.push("--output-dir", sanitizeShellArg(outputDir));
          if (repo) args.push("--repo", sanitizeShellArg(repo));
          if (setFile) setFile.forEach(s => args.push("--set-file", sanitizeShellArg(s)));
          if (setJson) setJson.forEach(s => args.push("--set-json", sanitizeShellArg(s)));
          if (setLiteral) setLiteral.forEach(s => args.push("--set-literal", sanitizeShellArg(s)));
          if (setString) setString.forEach(s => args.push("--set-string", sanitizeShellArg(s)));
          if (showOnly) showOnly.forEach(s => args.push("--show-only", sanitizeShellArg(s)));
          if (skipCRDs) args.push("--skip-crds");
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (verify) args.push("--verify");
          let output = runHelm(args, 60000);
          if (scrub) {
            output = scrubSensitiveData(output);
          }
          return {
            success: true,
            chart: sanitizedChart,
            namespace: ns,
            release: release || "RELEASE-NAME",
            scrubbed: scrub || false,
            templates: output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_template", resource: chart, namespace };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
  ];
}
