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

  // Remove shell metacharacters and control characters
  let sanitized = arg.replace(/[;&|`$(){}[\]<>!#*?~\n\r\t\\]/g, "");

  // Remove potentially dangerous escape sequences
  sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, "");
  sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, "");
  sanitized = sanitized.replace(/\\[0-7]{3}/g, "");

  // Remove command substitution patterns
  sanitized = sanitized.replace(/\$\([^)]*\)/g, "");
  sanitized = sanitized.replace(/`[^`]*`/g, "");

  // Remove pipe and redirection patterns
  sanitized = sanitized.replace(/\|/g, "");
  sanitized = sanitized.replace(/>/g, "");
  sanitized = sanitized.replace(/</g, "");

  // Limit length to prevent buffer overflow attacks
  const MAX_LENGTH = 1000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }

  return sanitized;
}
