import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseRollbackTools } from '../helm-tools/release-rollback.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Rollback Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseRollbackTools', () => {
    it('should register release rollback tools', () => {
      const tools = registerHelmReleaseRollbackTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_rollback tool', () => {
      const tools = registerHelmReleaseRollbackTools(mockK8sClient);
      const rollbackTool = tools.find(t => t.tool.name === 'k8s_helm_rollback');
      expect(rollbackTool).toBeDefined();
      expect(rollbackTool?.tool.description).toBe('Roll back to a previous revision');
      expect(rollbackTool?.tool.inputSchema).toBeDefined();
      expect(rollbackTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_rollback', () => {
      const tools = registerHelmReleaseRollbackTools(mockK8sClient);
      const rollbackTool = tools.find(t => t.tool.name === 'k8s_helm_rollback');
      const schema = rollbackTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
