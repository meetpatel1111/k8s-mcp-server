import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmDependencyManagementTools } from '../helm-tools/dependency-management.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Dependency Management Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmDependencyManagementTools', () => {
    it('should register dependency management tools', () => {
      const tools = registerHelmDependencyManagementTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_dependency tool', () => {
      const tools = registerHelmDependencyManagementTools(mockK8sClient);
      const dependencyTool = tools.find(t => t.tool.name === 'k8s_helm_dependency');
      expect(dependencyTool).toBeDefined();
      expect(dependencyTool?.tool.description).toBe('Manage Helm chart dependencies (list, update, build)');
      expect(dependencyTool?.tool.inputSchema).toBeDefined();
      expect(dependencyTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_dependency', () => {
      const tools = registerHelmDependencyManagementTools(mockK8sClient);
      const dependencyTool = tools.find(t => t.tool.name === 'k8s_helm_dependency');
      const schema = dependencyTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.command).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.required).toContain('command');
      expect(schema?.required).toContain('chart');
    });
  });
});
