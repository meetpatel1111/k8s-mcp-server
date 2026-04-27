import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseStatusTools } from '../helm-tools/release-status.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Status Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseStatusTools', () => {
    it('should register release status tools', () => {
      const tools = registerHelmReleaseStatusTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_status tool', () => {
      const tools = registerHelmReleaseStatusTools(mockK8sClient);
      const statusTool = tools.find(t => t.tool.name === 'k8s_helm_status');
      expect(statusTool).toBeDefined();
      expect(statusTool?.tool.description).toBe('Get status of a Helm release (like helm status)');
      expect(statusTool?.tool.inputSchema).toBeDefined();
      expect(statusTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_status', () => {
      const tools = registerHelmReleaseStatusTools(mockK8sClient);
      const statusTool = tools.find(t => t.tool.name === 'k8s_helm_status');
      const schema = statusTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
