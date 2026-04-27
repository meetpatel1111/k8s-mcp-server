/**
 * Protection mode tests
 */

import { validateConfig, ServerConfig } from '../config.js';

describe('Protection Modes', () => {
  describe('Config Validation', () => {
    it('should validate config with all protection modes enabled', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: true,
        strictProtectionEnabled: true,
        noDeleteProtectionEnabled: true,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config with all protection modes disabled', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: false,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config with mixed protection modes', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: true,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with invalid circuitBreakerTimeout', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 500, // Below min of 1000
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('circuitBreakerTimeout');
    });

    it('should reject config with invalid maxErrorsPerMinute', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 200, // Above max of 100
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('maxErrorsPerMinute');
    });

    it('should reject config with invalid cacheDefaultTtl', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 30000,
        cacheDefaultTtl: 70000, // Above max of 60000
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('cacheDefaultTtl');
    });

    it('should reject config with invalid defaultToolTimeout', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 60000,
        maxErrorsPerMinute: 10,
        defaultToolTimeout: 500, // Below min of 1000
        cacheDefaultTtl: 5000,
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('defaultToolTimeout');
    });

    it('should validate config at boundary values', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 1000, // Min
        maxErrorsPerMinute: 1, // Min
        defaultToolTimeout: 1000, // Min
        cacheDefaultTtl: 0, // Min
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config at max boundary values', () => {
      const config: ServerConfig = {
        circuitBreakerTimeout: 300000, // Max
        maxErrorsPerMinute: 100, // Max
        defaultToolTimeout: 300000, // Max
        cacheDefaultTtl: 60000, // Max
        infraProtectionEnabled: true,
        strictProtectionEnabled: false,
        noDeleteProtectionEnabled: false,
      };
      
      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
