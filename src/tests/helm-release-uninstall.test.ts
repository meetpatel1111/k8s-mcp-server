import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseUninstallTools } from '../helm-tools/release-uninstall.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Uninstall Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseUninstallTools', () => {
    it('should register release uninstall tools', () => {
      const tools = registerHelmReleaseUninstallTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_uninstall tool', () => {
      const tools = registerHelmReleaseUninstallTools(mockK8sClient);
      const uninstallTool = tools.find(t => t.tool.name === 'k8s_helm_uninstall');
      expect(uninstallTool).toBeDefined();
      expect(uninstallTool?.tool.description).toBe('Uninstall a Helm release');
      expect(uninstallTool?.tool.inputSchema).toBeDefined();
      expect(uninstallTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_uninstall', () => {
      const tools = registerHelmReleaseUninstallTools(mockK8sClient);
      const uninstallTool = tools.find(t => t.tool.name === 'k8s_helm_uninstall');
      const schema = uninstallTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
