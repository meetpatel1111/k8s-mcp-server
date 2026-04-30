/**
 * Input Sanitizer - Enterprise Security Layer
 * Deep traverses MCP arguments and strips dangerous shell injection characters.
 */

import { sanitizeShellArg } from "./shell-sanitizer.js";

const EXEMPT_TOOLS = new Set([
  // Tools that legitimately require complex shell commands or raw scripts
  "k8s_exec_pod",
  "k8s_run"
]);

const EXEMPT_ARGS = new Set([
  // Specific arguments that might contain legitimate JSON, scripts, or complex queries
  "command",
  "script",
  "jsonpath",
  "patch",
  "body",
  "manifest",
  "namespace",
  "annotations",
  "labels",
  "data",
  "value",
  "values",
  "path",
  "set",
  "setString",
  "setJson",
  "setLiteral",
  "setFile",
  "args",
  "image",
  "host"
]);

/**
 * Deeply sanitizes all string values within an arguments object,
 * unless the tool or specific argument is exempt.
 */
export function sanitizeInputArgs(toolName: string, args: any): any {
  if (!args) return args;

  // Bypass deep sanitization for tools that need raw access (they must handle their own security)
  if (EXEMPT_TOOLS.has(toolName)) {
    return args;
  }

  // Helper for deep traversal
  const traverseAndSanitize = (obj: any, keyName?: string): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === "string") {
      // If the argument name is exempt (like jsonpath), allow it
      if (keyName && EXEMPT_ARGS.has(keyName)) {
        return obj;
      }
      return sanitizeShellArg(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => traverseAndSanitize(item, keyName));
    }
    
    if (typeof obj === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitizedObj[key] = traverseAndSanitize(value, key);
      }
      return sanitizedObj;
    }
    
    return obj;
  };

  return traverseAndSanitize(args);
}
