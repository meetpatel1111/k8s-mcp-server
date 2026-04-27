/**
 * Configuration management for K8s MCP Server
 * Handles environment variable parsing and validation
 */

export interface ServerConfig {
  circuitBreakerTimeout: number;
  maxErrorsPerMinute: number;
  defaultToolTimeout: number;
  cacheDefaultTtl: number;
  infraProtectionEnabled: boolean;
  strictProtectionEnabled: boolean;
  noDeleteProtectionEnabled: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

const CONFIG_DEFAULTS: ServerConfig = {
  circuitBreakerTimeout: 60000,
  maxErrorsPerMinute: 10,
  defaultToolTimeout: 30000,
  cacheDefaultTtl: 5000,
  infraProtectionEnabled: true,
  strictProtectionEnabled: true,
  noDeleteProtectionEnabled: true,
};

const CONFIG_BOUNDS = {
  circuitBreakerTimeout: { min: 1000, max: 300000 },
  maxErrorsPerMinute: { min: 1, max: 100 },
  defaultToolTimeout: { min: 1000, max: 300000 },
  cacheDefaultTtl: { min: 0, max: 60000 },
};

/**
 * Parse and validate a numeric environment variable
 */
function parseNumberEnv(
  key: string,
  defaultValue: number,
  bounds?: { min: number; max: number }
): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.error(`Invalid ${key}: "${value}" is not a number. Using default: ${defaultValue}`);
    return defaultValue;
  }

  if (bounds && (parsed < bounds.min || parsed > bounds.max)) {
    console.error(
      `Invalid ${key}: ${parsed} is out of range [${bounds.min}, ${bounds.max}]. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Parse boolean environment variable
 */
function parseBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;

  const lower = value.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;

  console.error(`Invalid ${key}: "${value}" is not a boolean. Using default: ${defaultValue}`);
  return defaultValue;
}

/**
 * Validate configuration values
 */
export function validateConfig(config: ServerConfig): ConfigValidationResult {
  const errors: string[] = [];

  if (config.circuitBreakerTimeout < CONFIG_BOUNDS.circuitBreakerTimeout.min ||
      config.circuitBreakerTimeout > CONFIG_BOUNDS.circuitBreakerTimeout.max) {
    errors.push(
      `circuitBreakerTimeout must be between ${CONFIG_BOUNDS.circuitBreakerTimeout.min} and ${CONFIG_BOUNDS.circuitBreakerTimeout.max}`
    );
  }

  if (config.maxErrorsPerMinute < CONFIG_BOUNDS.maxErrorsPerMinute.min ||
      config.maxErrorsPerMinute > CONFIG_BOUNDS.maxErrorsPerMinute.max) {
    errors.push(
      `maxErrorsPerMinute must be between ${CONFIG_BOUNDS.maxErrorsPerMinute.min} and ${CONFIG_BOUNDS.maxErrorsPerMinute.max}`
    );
  }

  if (config.defaultToolTimeout < CONFIG_BOUNDS.defaultToolTimeout.min ||
      config.defaultToolTimeout > CONFIG_BOUNDS.defaultToolTimeout.max) {
    errors.push(
      `defaultToolTimeout must be between ${CONFIG_BOUNDS.defaultToolTimeout.min} and ${CONFIG_BOUNDS.defaultToolTimeout.max}`
    );
  }

  if (config.cacheDefaultTtl < CONFIG_BOUNDS.cacheDefaultTtl.min ||
      config.cacheDefaultTtl > CONFIG_BOUNDS.cacheDefaultTtl.max) {
    errors.push(
      `cacheDefaultTtl must be between ${CONFIG_BOUNDS.cacheDefaultTtl.min} and ${CONFIG_BOUNDS.cacheDefaultTtl.max}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ServerConfig {
  const config: ServerConfig = {
    circuitBreakerTimeout: parseNumberEnv(
      "K8S_CIRCUIT_BREAKER_TIMEOUT",
      CONFIG_DEFAULTS.circuitBreakerTimeout,
      CONFIG_BOUNDS.circuitBreakerTimeout
    ),
    maxErrorsPerMinute: parseNumberEnv(
      "K8S_MAX_ERRORS_PER_MINUTE",
      CONFIG_DEFAULTS.maxErrorsPerMinute,
      CONFIG_BOUNDS.maxErrorsPerMinute
    ),
    defaultToolTimeout: parseNumberEnv(
      "K8S_TOOL_TIMEOUT",
      CONFIG_DEFAULTS.defaultToolTimeout,
      CONFIG_BOUNDS.defaultToolTimeout
    ),
    cacheDefaultTtl: parseNumberEnv(
      "K8S_CACHE_TTL",
      CONFIG_DEFAULTS.cacheDefaultTtl,
      CONFIG_BOUNDS.cacheDefaultTtl
    ),
    infraProtectionEnabled: parseBooleanEnv(
      "INFRA_PROTECTION_MODE",
      CONFIG_DEFAULTS.infraProtectionEnabled
    ),
    strictProtectionEnabled: parseBooleanEnv(
      "STRICT_PROTECTION_MODE",
      CONFIG_DEFAULTS.strictProtectionEnabled
    ),
    noDeleteProtectionEnabled: parseBooleanEnv(
      "NO_DELETE_PROTECTION_MODE",
      CONFIG_DEFAULTS.noDeleteProtectionEnabled
    ),
  };

  // Validate and log results
  const validation = validateConfig(config);
  if (validation.valid) {
    console.error("Configuration validation passed");
  } else {
    console.error("Configuration validation errors:");
    validation.errors.forEach(err => console.error(`  - ${err}`));
  }

  return config;
}

/**
 * Get configuration defaults (useful for testing)
 */
export function getConfigDefaults(): ServerConfig {
  return { ...CONFIG_DEFAULTS };
}
