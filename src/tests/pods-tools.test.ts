import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerPodTools } from '../k8s-tools/pods.js';
import { K8sClient } from '../k8s-client.js';

describe('Pods Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerPodTools', () => {
    it('should register pod tools', () => {
      const tools = registerPodTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_pods tool', () => {
      const tools = registerPodTools(mockK8sClient);
      const listPodsTool = tools.find(t => t.tool.name === 'k8s_list_pods');
      expect(listPodsTool).toBeDefined();
      expect(listPodsTool?.tool.description).toBe('List pods across all namespaces or a specific namespace');
      expect(listPodsTool?.tool.inputSchema).toBeDefined();
      expect(listPodsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_pod tool', () => {
      const tools = registerPodTools(mockK8sClient);
      const getPodTool = tools.find(t => t.tool.name === 'k8s_get_pod');
      expect(getPodTool).toBeDefined();
      expect(getPodTool?.tool.description).toBe('Get detailed information about a specific pod');
      expect(getPodTool?.tool.inputSchema).toBeDefined();
      expect(getPodTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_list_pods', () => {
      const tools = registerPodTools(mockK8sClient);
      const listPodsTool = tools.find(t => t.tool.name === 'k8s_list_pods');
      const schema = listPodsTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.labelSelector).toBeDefined();
      expect(schema?.properties?.fieldSelector).toBeDefined();
      expect(schema?.properties?.context).toBeDefined();
    });

    it('should have valid input schema for k8s_get_pod', () => {
      const tools = registerPodTools(mockK8sClient);
      const getPodTool = tools.find(t => t.tool.name === 'k8s_get_pod');
      const schema = getPodTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });
  });
});
