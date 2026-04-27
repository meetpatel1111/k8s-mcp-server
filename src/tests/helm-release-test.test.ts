import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseTestTools } from '../helm-tools/release-test.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Test Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseTestTools', () => {
    it('should register release test tools', () => {
      const tools = registerHelmReleaseTestTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_test tool', () => {
      const tools = registerHelmReleaseTestTools(mockK8sClient);
      const testTool = tools.find(t => t.tool.name === 'k8s_helm_test');
      expect(testTool).toBeDefined();
      expect(testTool?.tool.description).toBe('Run tests for a Helm release');
      expect(testTool?.tool.inputSchema).toBeDefined();
      expect(testTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_test', () => {
      const tools = registerHelmReleaseTestTools(mockK8sClient);
      const testTool = tools.find(t => t.tool.name === 'k8s_helm_test');
      const schema = testTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
