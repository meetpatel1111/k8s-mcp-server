import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerMultiClusterTools } from '../k8s-tools/multi-cluster.js';
import { K8sClient } from '../k8s-client.js';

describe('Multi-Cluster Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerMultiClusterTools', () => {
    it('should register multi-cluster tools', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_kubeconfigs tool', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_list_kubeconfigs');
      expect(listTool).toBeDefined();
      expect(listTool?.tool.description).toBe('List available kubeconfig files and their contexts from common locations');
      expect(listTool?.tool.inputSchema).toBeDefined();
      expect(listTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_switch_kubeconfig tool', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const switchTool = tools.find(t => t.tool.name === 'k8s_switch_kubeconfig');
      expect(switchTool).toBeDefined();
      expect(switchTool?.tool.description).toBe('Switch to a different kubeconfig file. Sets KUBECONFIG_PATH environment variable and reloads the client configuration.');
      expect(switchTool?.tool.inputSchema).toBeDefined();
      expect(switchTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_add_kubeconfig tool', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const addTool = tools.find(t => t.tool.name === 'k8s_add_kubeconfig');
      expect(addTool).toBeDefined();
      expect(addTool?.tool.description).toBe('Add a new kubeconfig file path to the search list and optionally validate it');
      expect(addTool?.tool.inputSchema).toBeDefined();
      expect(addTool?.handler).toBeInstanceOf(Function);
    });
  });

  describe('k8s_list_kubeconfigs schema', () => {
    it('should have valid input schema', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_list_kubeconfigs');
      const schema = listTool?.tool.inputSchema as any;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.includeDetails).toBeDefined();
      expect(schema?.properties?.includeDetails?.type).toBe('boolean');
      expect(schema?.properties?.includeDetails?.default).toBe(true);
    });
  });

  describe('k8s_switch_kubeconfig schema', () => {
    it('should have valid input schema', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const switchTool = tools.find(t => t.tool.name === 'k8s_switch_kubeconfig');
      const schema = switchTool?.tool.inputSchema as any;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.path).toBeDefined();
      expect(schema?.properties?.path?.type).toBe('string');
      expect(schema?.properties?.context).toBeDefined();
      expect(schema?.properties?.context?.type).toBe('string');
      expect(schema?.required).toContain('path');
    });
  });

  describe('k8s_add_kubeconfig schema', () => {
    it('should have valid input schema', () => {
      const tools = registerMultiClusterTools(mockK8sClient);
      const addTool = tools.find(t => t.tool.name === 'k8s_add_kubeconfig');
      const schema = addTool?.tool.inputSchema as any;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.path).toBeDefined();
      expect(schema?.properties?.path?.type).toBe('string');
      expect(schema?.properties?.validate).toBeDefined();
      expect(schema?.properties?.validate?.type).toBe('boolean');
      expect(schema?.properties?.validate?.default).toBe(true);
      expect(schema?.required).toContain('path');
    });
  });
});
