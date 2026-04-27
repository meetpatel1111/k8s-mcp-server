import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmRepoManagementTools } from '../helm-tools/repo-management.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Repo Management Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmRepoManagementTools', () => {
    it('should register repo management tools', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_repo_list tool', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_repo_list');
      expect(listTool).toBeDefined();
      expect(listTool?.tool.description).toBe('List configured Helm chart repositories (like helm repo list)');
      expect(listTool?.tool.inputSchema).toBeDefined();
      expect(listTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_repo_add tool', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const addTool = tools.find(t => t.tool.name === 'k8s_helm_repo_add');
      expect(addTool).toBeDefined();
      expect(addTool?.tool.description).toBe('Add a Helm chart repository');
      expect(addTool?.tool.inputSchema).toBeDefined();
      expect(addTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_repo_remove tool', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const removeTool = tools.find(t => t.tool.name === 'k8s_helm_repo_remove');
      expect(removeTool).toBeDefined();
      expect(removeTool?.tool.description).toBe('Remove a Helm chart repository');
      expect(removeTool?.tool.inputSchema).toBeDefined();
      expect(removeTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_repo_update tool', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const updateTool = tools.find(t => t.tool.name === 'k8s_helm_repo_update');
      expect(updateTool).toBeDefined();
      expect(updateTool?.tool.description).toBe('Update Helm chart repositories (get latest charts)');
      expect(updateTool?.tool.inputSchema).toBeDefined();
      expect(updateTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_repo_index tool', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const indexTool = tools.find(t => t.tool.name === 'k8s_helm_repo_index');
      expect(indexTool).toBeDefined();
      expect(indexTool?.tool.description).toBe('Generate an index file given a directory containing packaged charts');
      expect(indexTool?.tool.inputSchema).toBeDefined();
      expect(indexTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_repo_list', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const listTool = tools.find(t => t.tool.name === 'k8s_helm_repo_list');
      const schema = listTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.output).toBeDefined();
    });

    it('should have valid input schema for k8s_helm_repo_add', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const addTool = tools.find(t => t.tool.name === 'k8s_helm_repo_add');
      const schema = addTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.url).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('url');
    });

    it('should have valid input schema for k8s_helm_repo_remove', () => {
      const tools = registerHelmRepoManagementTools(mockK8sClient);
      const removeTool = tools.find(t => t.tool.name === 'k8s_helm_repo_remove');
      const schema = removeTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });
  });
});
