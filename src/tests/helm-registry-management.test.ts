import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmRegistryManagementTools } from '../helm-tools/registry-management.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Registry Management Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmRegistryManagementTools', () => {
    it('should register registry management tools', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_registry_login tool', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const loginTool = tools.find(t => t.tool.name === 'k8s_helm_registry_login');
      expect(loginTool).toBeDefined();
      expect(loginTool?.tool.description).toBe('Login to an OCI registry for Helm charts');
      expect(loginTool?.tool.inputSchema).toBeDefined();
      expect(loginTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_registry_logout tool', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const logoutTool = tools.find(t => t.tool.name === 'k8s_helm_registry_logout');
      expect(logoutTool).toBeDefined();
      expect(logoutTool?.tool.description).toBe('Logout from an OCI registry');
      expect(logoutTool?.tool.inputSchema).toBeDefined();
      expect(logoutTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_push tool', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const pushTool = tools.find(t => t.tool.name === 'k8s_helm_push');
      expect(pushTool).toBeDefined();
      expect(pushTool?.tool.description).toBe('Push a chart to an OCI registry or remote URL');
      expect(pushTool?.tool.inputSchema).toBeDefined();
      expect(pushTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_registry_login', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const loginTool = tools.find(t => t.tool.name === 'k8s_helm_registry_login');
      const schema = loginTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.host).toBeDefined();
      expect(schema?.properties?.username).toBeDefined();
      expect(schema?.properties?.password).toBeDefined();
      expect(schema?.required).toContain('host');
    });

    it('should have valid input schema for k8s_helm_registry_logout', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const logoutTool = tools.find(t => t.tool.name === 'k8s_helm_registry_logout');
      const schema = logoutTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.host).toBeDefined();
      expect(schema?.required).toContain('host');
    });

    it('should have valid input schema for k8s_helm_push', () => {
      const tools = registerHelmRegistryManagementTools(mockK8sClient);
      const pushTool = tools.find(t => t.tool.name === 'k8s_helm_push');
      const schema = pushTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.remote).toBeDefined();
      expect(schema?.required).toContain('chart');
      expect(schema?.required).toContain('remote');
    });
  });
});
