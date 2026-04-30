/**
 * Secret Scrubber - PII and credential detection/redaction
 */

const SENSITIVE_PATTERNS = [
  // Password variations
  { pattern: /(password|passwd|pwd|pass|userpass|adminpass|rootpass)\s*[:=]\s*["']?[^\s"'\n]+["']?/gi, replacement: '$1: [REDACTED]' },
  { pattern: /(PASSWORD|PASSWD|PWD)\s*[:=]\s*["']?[^\s"'\n]+["']?/g, replacement: '$1: [REDACTED]' },

  // Token variations
  { pattern: /(token|access_token|refresh_token|auth_token|api_token|bearer_token|session_token|id_token)\s*[:=]\s*["']?[^\s"'\n]+["']?/gi, replacement: '$1: [REDACTED]' },
  { pattern: /(TOKEN|ACCESS_TOKEN|REFRESH_TOKEN)\s*[:=]\s*["']?[^\s"'\n]+["']?/g, replacement: '$1: [REDACTED]' },

  // Key variations
  { pattern: /(secret|secret_key|private_key|api_key|app_key|consumer_key|signing_key|encryption_key|decryption_key|master_key)\s*[:=]\s*["']?[^\s"'\n]+["']?/gi, replacement: '$1: [REDACTED]' },
  { pattern: /(apikey|api-key|appkey|app-key|client_secret|client_id|app_id|application_id)\s*[:=]\s*["']?[^\s"'\n]+["']?/gi, replacement: '$1: [REDACTED]' },

  // JWT tokens (eyJ... header pattern)
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[JWT_TOKEN_REDACTED]' },

  // Bearer tokens in HTTP headers
  { pattern: /(Bearer|Authorization:\s*Bearer)\s+[a-zA-Z0-9_\-\.]+/gi, replacement: '$1 [BEARER_TOKEN_REDACTED]' },
  { pattern: /(Authorization|Auth)\s*[:=]\s*["']?Basic\s+[a-zA-Z0-9+=/]+["']?/gi, replacement: '$1: [BASIC_AUTH_REDACTED]' },

  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_ACCESS_KEY_REDACTED]' },
  { pattern: /ASIA[0-9A-Z]{16}/g, replacement: '[AWS_TEMP_ACCESS_KEY_REDACTED]' },
  { pattern: /[A-Za-z0-9/+=]{40}/g, replacement: '[AWS_SECRET_KEY_REDACTED]' },

  // GCP keys
  { pattern: /AIza[0-9A-Za-z_-]{35}/g, replacement: '[GCP_API_KEY_REDACTED]' },

  // GitHub tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_PAT_REDACTED]' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_OAUTH_REDACTED]' },
  { pattern: /ghu_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_USER_TOKEN_REDACTED]' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_SERVER_TOKEN_REDACTED]' },
  { pattern: /ghr_[a-zA-Z0-9]{36}/g, replacement: '[GITHUB_REFRESH_TOKEN_REDACTED]' },

  // Slack tokens
  { pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?/g, replacement: '[SLACK_TOKEN_REDACTED]' },
  { pattern: /xoxe-[a-zA-Z0-9-]+/g, replacement: '[SLACK_OAUTH_REDACTED]' },

  // Generic API keys with common prefixes
  { pattern: /(sk|pk|rk)_live_[a-zA-Z0-9]{24,}/g, replacement: '[STRIPE_KEY_REDACTED]' },
  { pattern: /(sk|pk|rk)_test_[a-zA-Z0-9]{24,}/g, replacement: '[STRIPE_TEST_KEY_REDACTED]' },
  { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[OPENAI_API_KEY_REDACTED]' },

  // Private keys (PEM format)
  { pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY_REDACTED]' },
  { pattern: /-----BEGIN (RSA |DSA |EC )?PUBLIC KEY-----[\s\S]*?-----END (RSA |DSA |EC )?PUBLIC KEY-----/g, replacement: '[PUBLIC_KEY_REDACTED]' },

  // Certificate patterns
  { pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, replacement: '[CERTIFICATE_REDACTED]' },

  // Database connection strings with passwords
  { pattern: /(mongodb|mysql|postgresql|postgres|redis|amqp|jdbc|http|https|ftp):\/\/[^:\s"']+:[^@\s"']+@[^\s"']+/gi, replacement: '$1://[USER]:[PASSWORD]@[HOST_REDACTED]' },

  // URL with credentials (user:pass@host)
  { pattern: /:\/\/[^:\s"'/]+:[^@\s"'/]+@[a-zA-Z0-9.-]+/g, replacement: '://[USER]:[PASSWORD]@[HOST]' },

  // Base64 encoded secrets (common patterns)
  { pattern: /Basic\s+[a-zA-Z0-9+=/]{20,}/g, replacement: 'Basic [BASE64_AUTH_REDACTED]' },

  // OAuth tokens
  { pattern: /(oauth_token|oauth_token_secret|oauth_consumer_key|oauth_consumer_secret|oauth_signature)\s*[:=]\s*["']?[^\s"'\n]+["']?/gi, replacement: '$1: [OAUTH_TOKEN_REDACTED]' },

  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },

  // Credit card numbers (major patterns)
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/g, replacement: '[CREDIT_CARD_REDACTED]' },

  // SSN patterns (US Social Security)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },

  // Phone numbers (common formats)
  { pattern: /\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\b/g, replacement: '[PHONE_REDACTED]' },

  // Environment variable style secrets
  { pattern: /(export\s+)?(SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY)\s*=\s*[^\s\n]+/gi, replacement: '$2=[ENV_SECRET_REDACTED]' },

  // Docker registry auth
  { pattern: /"auth"\s*:\s*"[a-zA-Z0-9+/=]+"/g, replacement: '"auth": "[DOCKER_AUTH_REDACTED]"' },

  // .htpasswd style entries
  { pattern: /^[^:]+:[^:]+:[a-f0-9]{32,}$/gm, replacement: '[HTPASSWD_ENTRY_REDACTED]' },
];

export function scrubSensitiveData(content: string): string {
  let scrubbed = content;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

export function containsSensitivePatterns(content: string): boolean {
  return SENSITIVE_PATTERNS.some(({ pattern }) => pattern.test(content));
}
