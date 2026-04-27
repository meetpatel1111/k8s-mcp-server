import {
  validateResourceName,
  validateNamespace,
  validateLabelSelector,
  validatePort,
  validateReplicas,
} from '../validators.js';

describe('Validators', () => {
  describe('validateResourceName', () => {
    it('should accept valid resource names', () => {
      expect(() => validateResourceName('my-pod', 'Pod')).not.toThrow();
      expect(() => validateResourceName('my.pod', 'Pod')).not.toThrow();
      expect(() => validateResourceName('my123pod', 'Pod')).not.toThrow();
      expect(() => validateResourceName('123pod', 'Pod')).not.toThrow();
    });

    it('should reject resource names with underscores', () => {
      expect(() => validateResourceName('my_pod', 'Pod')).toThrow();
    });

    it('should reject resource names that are too long', () => {
      const longName = 'a'.repeat(254);
      expect(() => validateResourceName(longName, 'Pod')).toThrow();
    });

    it('should reject resource names with invalid characters', () => {
      expect(() => validateResourceName('my@pod', 'Pod')).toThrow();
      expect(() => validateResourceName('my pod', 'Pod')).toThrow();
      expect(() => validateResourceName('my/pod', 'Pod')).toThrow();
    });

    it('should reject empty resource names', () => {
      expect(() => validateResourceName('', 'Pod')).toThrow();
    });
  });

  describe('validateNamespace', () => {
    it('should accept valid namespace names', () => {
      expect(() => validateNamespace('default')).not.toThrow();
      expect(() => validateNamespace('my-namespace')).not.toThrow();
      expect(() => validateNamespace('my.namespace')).not.toThrow();
    });

    it('should reject namespace names with underscores', () => {
      expect(() => validateNamespace('my_namespace')).toThrow();
    });

    it('should reject namespace names that are too long', () => {
      const longName = 'a'.repeat(254);
      expect(() => validateNamespace(longName)).toThrow();
    });

    it('should reject namespace names with invalid characters', () => {
      expect(() => validateNamespace('my@namespace')).toThrow();
      expect(() => validateNamespace('my namespace')).toThrow();
    });

    it('should reject empty namespace names', () => {
      expect(() => validateNamespace('')).toThrow();
    });
  });

  describe('validateLabelSelector', () => {
    it('should accept valid label selectors', () => {
      expect(() => validateLabelSelector('app=nginx')).not.toThrow();
      expect(() => validateLabelSelector('app=nginx,env=prod')).not.toThrow();
      expect(() => validateLabelSelector('app=nginx,env!=dev')).not.toThrow();
    });

    it('should reject empty label selector', () => {
      expect(() => validateLabelSelector('')).toThrow();
    });
  });

  describe('validatePort', () => {
    it('should accept valid port numbers', () => {
      expect(() => validatePort(80)).not.toThrow();
      expect(() => validatePort(8080)).not.toThrow();
      expect(() => validatePort(65535)).not.toThrow();
    });

    it('should reject port numbers out of range', () => {
      expect(() => validatePort(0)).toThrow();
      expect(() => validatePort(65536)).toThrow();
      expect(() => validatePort(-1)).toThrow();
    });

    it('should reject non-numeric ports', () => {
      expect(() => validatePort(NaN)).toThrow();
    });
  });

  describe('validateReplicas', () => {
    it('should accept valid replica counts', () => {
      expect(() => validateReplicas(0)).not.toThrow();
      expect(() => validateReplicas(1)).not.toThrow();
      expect(() => validateReplicas(10)).not.toThrow();
    });

    it('should reject negative replica counts', () => {
      expect(() => validateReplicas(-1)).toThrow();
    });

    it('should reject non-numeric replicas', () => {
      expect(() => validateReplicas(NaN)).toThrow();
    });
  });
});
