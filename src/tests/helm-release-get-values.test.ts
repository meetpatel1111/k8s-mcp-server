import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseGetValuesTools } from '../helm-tools/release-get-values.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Get Values Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseGetValuesTools', () => {
    it('should register release get values tools', () => {
      const tools = registerHelmReleaseGetValuesTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_values tool', () => {
      const tools = registerHelmReleaseGetValuesTools(mockK8sClient);
      const valuesTool = tools.find(t => t.tool.name === 'k8s_helm_values');
      expect(valuesTool).toBeDefined();
      expect(valuesTool?.tool.description).toBe('Get the values of a Helm release (like helm get values)');
      expect(valuesTool?.tool.inputSchema).toBeDefined();
      expect(valuesTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_values', () => {
      const tools = registerHelmReleaseGetValuesTools(mockK8sClient);
      const valuesTool = tools.find(t => t.tool.name === 'k8s_helm_values');
      const schema = valuesTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
