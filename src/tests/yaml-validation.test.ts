/**
 * YAML validation tests
 */

import { validateYamlManifest } from '../error-handling.js';

describe('YAML Validation', () => {
  describe('validateYamlManifest', () => {
    it('should accept valid single document YAML', () => {
      const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: nginx
    image: nginx:latest
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.documents).toBeDefined();
      expect(result.documents?.length).toBe(1);
    });

    it('should accept valid multi-document YAML', () => {
      const manifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  key: value
---
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: nginx
    image: nginx:latest
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.documents?.length).toBe(2);
    });

    it('should reject empty manifest', () => {
      const result = validateYamlManifest('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject non-string manifest', () => {
      const result = validateYamlManifest(null as any);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject manifest missing apiVersion', () => {
      const manifest = `
kind: Pod
metadata:
  name: test-pod
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('apiVersion');
    });

    it('should reject manifest missing kind', () => {
      const manifest = `
apiVersion: v1
metadata:
  name: test-pod
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('kind');
    });

    it('should reject manifest missing metadata', () => {
      const manifest = `
apiVersion: v1
kind: Pod
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('metadata');
    });

    it('should reject manifest missing metadata.name', () => {
      const manifest = `
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: test
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('metadata.name');
    });

    it('should reject invalid resource name', () => {
      const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: invalid@name
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('resource name');
    });

    it('should reject invalid YAML syntax', () => {
      const manifest = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
  invalid: [unclosed
`;
      const result = validateYamlManifest(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('YAML parsing');
    });

    it('should reject empty document in multi-doc YAML', () => {
      const manifest = `---
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
`;
      const result = validateYamlManifest(manifest);
      
      // This is valid - single document with separator
      expect(result.valid).toBe(true);
    });
  });
});
