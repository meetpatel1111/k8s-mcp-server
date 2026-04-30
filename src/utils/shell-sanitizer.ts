/**
 * Shell argument sanitization utilities
 * Provides safe handling of shell arguments to prevent command injection
 */

/**
 * Sanitize a string for use as a shell argument
 * Removes characters that could be used for command injection
 */
export function sanitizeShellArg(arg: string): string {
  if (!arg || typeof arg !== "string") return "";

  // Remove dangerous shell metacharacters but PRESERVE newlines and tabs which are needed for manifests
  // Remove dangerous shell metacharacters but PRESERVE characters needed for K8s regexes/manifests
  // Permitted: $ (regex), ( ) (regex), [ ] (labels), { } (interpolation), < > (config), ! # * ? (wildcards/regex), \ (escaping)
  // Blocked: ; (cmd sep), & (cmd sep), ` (backticks)
  // Note: | (pipe) is allowed as it is essential for K8s regex paths
  // and we use execFileSync which doesn't invoke a shell.
  let sanitized = arg.replace(/[;&`]/g, "");

  // Remove potentially dangerous escape sequences
  sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, "");
  sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, "");
  sanitized = sanitized.replace(/\\[0-7]{3}/g, "");

  // Limit length to prevent buffer overflow attacks, but allow large payloads for manifests
  const MAX_LENGTH = 1000000; // 1MB
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }

  return sanitized;
}
