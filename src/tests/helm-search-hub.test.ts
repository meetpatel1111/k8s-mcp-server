import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmSearchHubTools } from '../helm-tools/search-hub.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Search Hub Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmSearchHubTools', () => {
    it('should register search hub tools', () => {
      const tools = registerHelmSearchHubTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_search tool', () => {
      const tools = registerHelmSearchHubTools(mockK8sClient);
      const searchTool = tools.find(t => t.tool.name === 'k8s_helm_search');
      expect(searchTool).toBeDefined();
      expect(searchTool?.tool.description).toBe('Search for Helm charts in artifact hub or local repos (like helm search)');
      expect(searchTool?.tool.inputSchema).toBeDefined();
      expect(searchTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_search', () => {
      const tools = registerHelmSearchHubTools(mockK8sClient);
      const searchTool = tools.find(t => t.tool.name === 'k8s_helm_search');
      const schema = searchTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.keyword).toBeDefined();
      expect(schema?.required).toContain('keyword');
    });
  });
});
