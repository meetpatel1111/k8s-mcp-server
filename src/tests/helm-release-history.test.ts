import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseHistoryTools } from '../helm-tools/release-history.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release History Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseHistoryTools', () => {
    it('should register release history tools', () => {
      const tools = registerHelmReleaseHistoryTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_history tool', () => {
      const tools = registerHelmReleaseHistoryTools(mockK8sClient);
      const historyTool = tools.find(t => t.tool.name === 'k8s_helm_history');
      expect(historyTool).toBeDefined();
      expect(historyTool?.tool.description).toBe('Get release history of a Helm chart (like helm history)');
      expect(historyTool?.tool.inputSchema).toBeDefined();
      expect(historyTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_history', () => {
      const tools = registerHelmReleaseHistoryTools(mockK8sClient);
      const historyTool = tools.find(t => t.tool.name === 'k8s_helm_history');
      const schema = historyTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
