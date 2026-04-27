import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseInstallTools } from '../helm-tools/release-install.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Install Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseInstallTools', () => {
    it('should register release install tools', () => {
      const tools = registerHelmReleaseInstallTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_install tool', () => {
      const tools = registerHelmReleaseInstallTools(mockK8sClient);
      const installTool = tools.find(t => t.tool.name === 'k8s_helm_install');
      expect(installTool).toBeDefined();
      expect(installTool?.tool.description).toBe('Install a Helm chart into Kubernetes');
      expect(installTool?.tool.inputSchema).toBeDefined();
      expect(installTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_install', () => {
      const tools = registerHelmReleaseInstallTools(mockK8sClient);
      const installTool = tools.find(t => t.tool.name === 'k8s_helm_install');
      const schema = installTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('chart');
    });
  });
});
