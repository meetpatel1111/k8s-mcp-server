import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseListTools } from '../helm-tools/release-list.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release List Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseListTools', () => {
    it('should register release list tools', () => {
      const tools = registerHelmReleaseListTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_list tool', () => {
      const tools = registerHelmReleaseListTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_list');
      expect(listTool).toBeDefined();
      expect(listTool?.tool.description).toBe('List Helm releases (like helm list). Shows all installed Helm charts.');
      expect(listTool?.tool.inputSchema).toBeDefined();
      expect(listTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_list', () => {
      const tools = registerHelmReleaseListTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_list');
      const schema = listTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.filter).toBeDefined();
      expect(schema?.properties?.output).toBeDefined();
    });
  });
});
