import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { K8sClient } from "../k8s-client.js";
import { classifyError, ErrorContext } from "../error-handling.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";
import { isHelmInstalled, runHelm, helmUnavailableResponse } from "./common.js";

export function registerHelmPluginManagementTools(k8sClient: K8sClient): { tool: Tool; handler: Function }[] {
  const helmAvailable = isHelmInstalled();

  return [
    {
      tool: {
        name: "k8s_helm_plugin_list",
        description: "List installed Helm plugins",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Plugin type filter (e.g., 'helm' or 'oci')",
            },
          },
        },
      },
      handler: async ({ type }: { type?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["plugin", "list"];
          if (type) args.push("--type", sanitizeShellArg(type));
          const output = runHelm(args);
          const plugins = output.split("\n").filter(line => line.trim()).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              name: parts[0] || "",
              version: parts[1] || "",
              description: parts.slice(2).join(" ") || "",
            };
          });
          return {
            plugins: plugins.slice(1),
            total: plugins.length - 1,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_list" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_plugin_install",
        description: "Install a Helm plugin",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path or URL to the plugin",
            },
            version: {
              type: "string",
              description: "Specific version to install",
            },
            verify: {
              type: "boolean",
              description: "Verify the plugin signature before installing",
              default: true,
            },
            keyring: {
              type: "string",
              description: "Location of public keys for verification (default: ~/.gnupg/pubring.gpg)",
            },
            username: {
              type: "string",
              description: "Registry username for plugin download",
            },
            password: {
              type: "string",
              description: "Registry password for plugin download",
            },
            insecureSkipTlsVerify: {
              type: "boolean",
              description: "Skip TLS certificate checks for plugin download",
              default: false,
            },
            plainHttp: {
              type: "boolean",
              description: "Use insecure HTTP connections for the plugin download",
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
          },
          required: ["path"],
        },
      },
      handler: async ({ path, version, verify, keyring, username, password, insecureSkipTlsVerify, plainHttp, caFile, certFile, keyFile }: { 
        path: string; 
        version?: string;
        verify?: boolean;
        keyring?: string;
        username?: string;
        password?: string;
        insecureSkipTlsVerify?: boolean;
        plainHttp?: boolean;
        caFile?: string;
        certFile?: string;
        keyFile?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedPath = sanitizeShellArg(path);
          const args: string[] = ["plugin", "install", sanitizedPath];
          if (version) args.push("--version", sanitizeShellArg(version));
          if (verify === false) args.push("--verify=false");
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (username) args.push("--username", sanitizeShellArg(username));
          if (password) args.push("--password", sanitizeShellArg(password));
          if (insecureSkipTlsVerify) args.push("--insecure-skip-tls-verify");
          if (plainHttp) args.push("--plain-http");
          if (caFile) args.push("--ca-file", sanitizeShellArg(caFile));
          if (certFile) args.push("--cert-file", sanitizeShellArg(certFile));
          if (keyFile) args.push("--key-file", sanitizeShellArg(keyFile));
          const output = runHelm(args, 60000);
          return {
            success: true,
            path: sanitizedPath,
            version,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_install" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_plugin_uninstall",
        description: "Uninstall one or more Helm plugins",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Plugin names to uninstall",
            },
          },
          required: ["names"],
        },
      },
      handler: async ({ names }: { names: string[] }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedNames = names.map(n => sanitizeShellArg(n));
          const args: string[] = ["plugin", "uninstall", ...sanitizedNames];
          const output = runHelm(args);
          return {
            success: true,
            names: sanitizedNames,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_uninstall" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_plugin_update",
        description: "Update Helm plugins",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Specific plugin to update (default: all)",
            },
          },
        },
      },
      handler: async ({ name }: { name?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const args: string[] = ["plugin", "update"];
          if (name) args.push(sanitizeShellArg(name));
          const output = runHelm(args, 60000);
          return {
            success: true,
            updated: name || "all plugins",
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_update" };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_plugin_package",
        description: "Package a Helm plugin directory into a plugin archive",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the plugin directory",
            },
            destination: {
              type: "string",
              description: "Destination to write the plugin archive",
            },
            sign: {
              type: "boolean",
              description: "Use a PGP private key to sign the package",
              default: true,
            },
            keyring: {
              type: "string",
              description: "Location of a public keyring (default: ~/.gnupg/pubring.gpg)",
            },
            key: {
              type: "string",
              description: "Name of the key to use for signing",
            },
            passphraseFile: {
              type: "string",
              description: "File containing the passphrase for the private key",
            },
          },
          required: ["path"],
        },
      },
      handler: async ({ path, destination, sign, key, passphraseFile, keyring }: {
        path: string;
        destination?: string;
        sign?: boolean;
        key?: string;
        passphraseFile?: string;
        keyring?: string;
      }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedPath = sanitizeShellArg(path);
          const args: string[] = ["plugin", "package", sanitizedPath];
          if (destination) args.push("-d", sanitizeShellArg(destination));
          if (sign === false) args.push("--sign=false");
          if (key) args.push("--key", sanitizeShellArg(key));
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          if (passphraseFile) args.push("--passphrase-file", sanitizeShellArg(passphraseFile));
          const output = runHelm(args, 60000);
          return {
            success: true,
            path: sanitizedPath,
            destination,
            signed: sign !== false,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_package", resource: path };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions };
        }
      },
    },
    {
      tool: {
        name: "k8s_helm_plugin_verify",
        description: "Verify that a Helm plugin has been signed and is valid",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the plugin package",
            },
            keyring: {
              type: "string",
              description: "Path to public keys used for verification",
            },
          },
          required: ["path"],
        },
      },
      handler: async ({ path, keyring }: { path: string; keyring?: string }) => {
        if (!helmAvailable) return helmUnavailableResponse;
        try {
          const sanitizedPath = sanitizeShellArg(path);
          const args: string[] = ["plugin", "verify", sanitizedPath];
          if (keyring) args.push("--keyring", sanitizeShellArg(keyring));
          const output = runHelm(args);
          return {
            success: true,
            path: sanitizedPath,
            verified: true,
            output,
          };
        } catch (error) {
          const context: ErrorContext = { operation: "k8s_helm_plugin_verify", resource: path };
          const classified = classifyError(error, context);
          return { error: classified.message, suggestions: classified.suggestions, verified: false };
        }
      },
    },
  ];
}
