import { execFileSync } from "child_process";
import { validateResourceName, validateNamespace } from "../validators.js";
import { sanitizeShellArg } from "../utils/shell-sanitizer.js";

export function isHelmInstalled(): boolean {
  try {
    execFileSync("helm", ["version", "--short"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function runHelm(args: string[], timeout = 30000): string {
  try {
    return execFileSync("helm", args, {
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error: any) {
    throw new Error(error.stderr || error.message || `helm ${args.join(" ")} failed`);
  }
}

export function parseHelmJson(args: string[], timeout = 30000): any {
  const output = runHelm([...args, "-o", "json"], timeout);
  return JSON.parse(output);
}

export function sanitizeHelmNamespace(namespace: string | undefined): string {
  if (!namespace) return "default";
  const sanitized = sanitizeShellArg(namespace);
  try {
    validateNamespace(sanitized);
    return sanitized;
  } catch {
    return "default";
  }
}

export function sanitizeHelmRelease(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("Release name is required");
  }
  const sanitized = sanitizeShellArg(name);
  validateResourceName(sanitized, "release");
  return sanitized;
}

export const helmUnavailableResponse = {
  error: "Helm is not installed or not in PATH",
  suggestions: [
    "Install Helm: https://helm.sh/docs/intro/install/",
    "macOS: brew install helm",
    "Windows: choco install kubernetes-helm",
    "Linux: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash",
  ],
};
