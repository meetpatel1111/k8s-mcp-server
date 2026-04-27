import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmPluginManagementTools } from '../helm-tools/plugin-management.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Plugin Management Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmPluginManagementTools', () => {
    it('should register plugin management tools', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_plugin_list tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_list');
      expect(listTool).toBeDefined();
      expect(listTool?.tool.description).toBe('List installed Helm plugins');
      expect(listTool?.tool.inputSchema).toBeDefined();
      expect(listTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_plugin_install tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const installTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_install');
      expect(installTool).toBeDefined();
      expect(installTool?.tool.description).toBe('Install a Helm plugin');
      expect(installTool?.tool.inputSchema).toBeDefined();
      expect(installTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_plugin_uninstall tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const uninstallTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_uninstall');
      expect(uninstallTool).toBeDefined();
      expect(uninstallTool?.tool.description).toBe('Uninstall one or more Helm plugins');
      expect(uninstallTool?.tool.inputSchema).toBeDefined();
      expect(uninstallTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_plugin_update tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const updateTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_update');
      expect(updateTool).toBeDefined();
      expect(updateTool?.tool.description).toBe('Update Helm plugins');
      expect(updateTool?.tool.inputSchema).toBeDefined();
      expect(updateTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_plugin_package tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const packageTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_package');
      expect(packageTool).toBeDefined();
      expect(packageTool?.tool.description).toBe('Package a Helm plugin directory into a plugin archive');
      expect(packageTool?.tool.inputSchema).toBeDefined();
      expect(packageTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_plugin_verify tool', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const verifyTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_verify');
      expect(verifyTool).toBeDefined();
      expect(verifyTool?.tool.description).toBe('Verify that a Helm plugin has been signed and is valid');
      expect(verifyTool?.tool.inputSchema).toBeDefined();
      expect(verifyTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_plugin_list', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_list');
      const schema = listTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.type).toBeDefined();
    });

    it('should have valid input schema for k8s_helm_plugin_install', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const installTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_install');
      const schema = installTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.path).toBeDefined();
      expect(schema?.properties?.version).toBeDefined();
      expect(schema?.required).toContain('path');
    });

    it('should have valid input schema for k8s_helm_plugin_uninstall', () => {
      const tools = registerHelmPluginManagementTools(mockK8sClient);
      const uninstallTool = tools.find(t => t.tool.name === 'k8s_helm_plugin_uninstall');
      const schema = uninstallTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.names).toBeDefined();
      expect(schema?.required).toContain('names');
    });
  });
});
