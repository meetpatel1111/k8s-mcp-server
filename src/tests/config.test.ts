import { loadConfig, ServerConfig } from '../config.js';

describe('Config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('loadConfig', () => {
    it('should load default config when no env vars set', () => {
      const config = loadConfig();
      
      expect(config).toBeDefined();
      expect(config.cacheDefaultTtl).toBe(5000);
      expect(config.circuitBreakerTimeout).toBe(60000);
      expect(config.maxErrorsPerMinute).toBe(10);
      expect(config.defaultToolTimeout).toBe(30000);
      expect(config.infraProtectionEnabled).toBe(true);
      expect(config.strictProtectionEnabled).toBe(true);
      expect(config.noDeleteProtectionEnabled).toBe(true);
    });

    it('should override cache settings from env vars', () => {
      process.env.K8S_CACHE_TTL = '10000';
      
      const config = loadConfig();
      
      expect(config.cacheDefaultTtl).toBe(10000);
    });

    it('should override circuit breaker settings from env vars', () => {
      process.env.K8S_CIRCUIT_BREAKER_TIMEOUT = '30000';
      process.env.K8S_MAX_ERRORS_PER_MINUTE = '5';
      
      const config = loadConfig();
      
      expect(config.circuitBreakerTimeout).toBe(30000);
      expect(config.maxErrorsPerMinute).toBe(5);
    });

    it('should parse boolean env vars correctly', () => {
      process.env.INFRA_PROTECTION_MODE = 'false';
      process.env.STRICT_PROTECTION_MODE = 'true';
      
      const config = loadConfig();
      
      expect(config.infraProtectionEnabled).toBe(false);
      expect(config.strictProtectionEnabled).toBe(true);
    });

    it('should handle invalid boolean env vars gracefully', () => {
      process.env.INFRA_PROTECTION_MODE = 'invalid';
      
      const config = loadConfig();
      
      // Should default to true for invalid values
      expect(config.infraProtectionEnabled).toBe(true);
    });

    it('should handle invalid number env vars gracefully', () => {
      process.env.K8S_CACHE_TTL = 'invalid';
      
      const config = loadConfig();
      
      // Should use default for invalid values
      expect(config.cacheDefaultTtl).toBe(5000);
    });
  });
});
