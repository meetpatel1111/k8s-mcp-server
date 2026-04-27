import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmEnvironmentTools } from '../helm-tools/environment.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Environment Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmEnvironmentTools', () => {
    it('should register environment tools', () => {
      const tools = registerHelmEnvironmentTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_env tool', () => {
      const tools = registerHelmEnvironmentTools(mockK8sClient);
      const envTool = tools.find(t => t.tool.name === 'k8s_helm_env');
      expect(envTool).toBeDefined();
      expect(envTool?.tool.description).toBe('Display Helm environment information');
      expect(envTool?.tool.inputSchema).toBeDefined();
      expect(envTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_version tool', () => {
      const tools = registerHelmEnvironmentTools(mockK8sClient);
      const versionTool = tools.find(t => t.tool.name === 'k8s_helm_version');
      expect(versionTool).toBeDefined();
      expect(versionTool?.tool.description).toBe('Display Helm version information');
      expect(versionTool?.tool.inputSchema).toBeDefined();
      expect(versionTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_version', () => {
      const tools = registerHelmEnvironmentTools(mockK8sClient);
      const versionTool = tools.find(t => t.tool.name === 'k8s_helm_version');
      const schema = versionTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.short).toBeDefined();
      expect(schema?.properties?.template).toBeDefined();
    });
  });
});
