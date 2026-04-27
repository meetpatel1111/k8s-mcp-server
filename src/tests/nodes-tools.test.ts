import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerNodeTools } from '../k8s-tools/nodes.js';
import { K8sClient } from '../k8s-client.js';

describe('Nodes Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerNodeTools', () => {
    it('should register node tools', () => {
      const tools = registerNodeTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_nodes tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const listNodesTool = tools.find(t => t.tool.name === 'k8s_list_nodes');
      expect(listNodesTool).toBeDefined();
      expect(listNodesTool?.tool.description).toBe('List all nodes in the cluster with status and resource information');
      expect(listNodesTool?.tool.inputSchema).toBeDefined();
      expect(listNodesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_node tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const getNodeTool = tools.find(t => t.tool.name === 'k8s_get_node');
      expect(getNodeTool).toBeDefined();
      expect(getNodeTool?.tool.description).toBe('Get detailed information about a specific node');
      expect(getNodeTool?.tool.inputSchema).toBeDefined();
      expect(getNodeTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cordon_node tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const cordonTool = tools.find(t => t.tool.name === 'k8s_cordon_node');
      expect(cordonTool).toBeDefined();
      expect(cordonTool?.tool.description).toBe('Mark a node as unschedulable (cordon)');
      expect(cordonTool?.tool.inputSchema).toBeDefined();
      expect(cordonTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_uncordon_node tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const uncordonTool = tools.find(t => t.tool.name === 'k8s_uncordon_node');
      expect(uncordonTool).toBeDefined();
      expect(uncordonTool?.tool.description).toBe('Mark a node as schedulable (uncordon)');
      expect(uncordonTool?.tool.inputSchema).toBeDefined();
      expect(uncordonTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_drain_node tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const drainTool = tools.find(t => t.tool.name === 'k8s_drain_node');
      expect(drainTool).toBeDefined();
      expect(drainTool?.tool.description).toBe('Drain a node by cordoning it and evicting all pods');
      expect(drainTool?.tool.inputSchema).toBeDefined();
      expect(drainTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_add_node_taint tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const addTaintTool = tools.find(t => t.tool.name === 'k8s_add_node_taint');
      expect(addTaintTool).toBeDefined();
      expect(addTaintTool?.tool.description).toBe('Add a taint to a node');
      expect(addTaintTool?.tool.inputSchema).toBeDefined();
      expect(addTaintTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_remove_node_taint tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const removeTaintTool = tools.find(t => t.tool.name === 'k8s_remove_node_taint');
      expect(removeTaintTool).toBeDefined();
      expect(removeTaintTool?.tool.description).toBe('Remove a taint from a node');
      expect(removeTaintTool?.tool.inputSchema).toBeDefined();
      expect(removeTaintTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_add_node_label tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const addLabelTool = tools.find(t => t.tool.name === 'k8s_add_node_label');
      expect(addLabelTool).toBeDefined();
      expect(addLabelTool?.tool.description).toBe('Add or update a label on a node');
      expect(addLabelTool?.tool.inputSchema).toBeDefined();
      expect(addLabelTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_remove_node_label tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const removeLabelTool = tools.find(t => t.tool.name === 'k8s_remove_node_label');
      expect(removeLabelTool).toBeDefined();
      expect(removeLabelTool?.tool.description).toBe('Remove a label from a node');
      expect(removeLabelTool?.tool.inputSchema).toBeDefined();
      expect(removeLabelTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_node_pressure_status tool', () => {
      const tools = registerNodeTools(mockK8sClient);
      const pressureTool = tools.find(t => t.tool.name === 'k8s_node_pressure_status');
      expect(pressureTool).toBeDefined();
      expect(pressureTool?.tool.description).toBe('Check for node pressure conditions (Memory, Disk, PID)');
      expect(pressureTool?.tool.inputSchema).toBeDefined();
      expect(pressureTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_list_nodes', () => {
      const tools = registerNodeTools(mockK8sClient);
      const listNodesTool = tools.find(t => t.tool.name === 'k8s_list_nodes');
      const schema = listNodesTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
    });

    it('should have valid input schema for k8s_get_node', () => {
      const tools = registerNodeTools(mockK8sClient);
      const getNodeTool = tools.find(t => t.tool.name === 'k8s_get_node');
      const schema = getNodeTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_cordon_node', () => {
      const tools = registerNodeTools(mockK8sClient);
      const cordonTool = tools.find(t => t.tool.name === 'k8s_cordon_node');
      const schema = cordonTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_add_node_taint', () => {
      const tools = registerNodeTools(mockK8sClient);
      const addTaintTool = tools.find(t => t.tool.name === 'k8s_add_node_taint');
      const schema = addTaintTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.key).toBeDefined();
      expect(schema?.properties?.effect).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('key');
      expect(schema?.required).toContain('effect');
    });
  });
});
