import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseUpgradeTools } from '../helm-tools/release-upgrade.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Upgrade Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseUpgradeTools', () => {
    it('should register release upgrade tools', () => {
      const tools = registerHelmReleaseUpgradeTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_upgrade tool', () => {
      const tools = registerHelmReleaseUpgradeTools(mockK8sClient);
      const upgradeTool = tools.find(t => t.tool.name === 'k8s_helm_upgrade');
      expect(upgradeTool).toBeDefined();
      expect(upgradeTool?.tool.description).toBe('Upgrade a Helm release to a new version of a chart');
      expect(upgradeTool?.tool.inputSchema).toBeDefined();
      expect(upgradeTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_upgrade', () => {
      const tools = registerHelmReleaseUpgradeTools(mockK8sClient);
      const upgradeTool = tools.find(t => t.tool.name === 'k8s_helm_upgrade');
      const schema = upgradeTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
      expect(schema?.required).toContain('chart');
    });
  });
});
