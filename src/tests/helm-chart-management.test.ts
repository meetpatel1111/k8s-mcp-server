import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmChartManagementTools } from '../helm-tools/chart-management.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Chart Management Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmChartManagementTools', () => {
    it('should register chart management tools', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_create tool', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const createTool = tools.find(t => t.tool.name === 'k8s_helm_create');
      expect(createTool).toBeDefined();
      expect(createTool?.tool.description).toBe('Create a new Helm chart directory with common files and directories');
      expect(createTool?.tool.inputSchema).toBeDefined();
      expect(createTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_package tool', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const packageTool = tools.find(t => t.tool.name === 'k8s_helm_package');
      expect(packageTool).toBeDefined();
      expect(packageTool?.tool.description).toBe('Package a Helm chart into a versioned chart archive file');
      expect(packageTool?.tool.inputSchema).toBeDefined();
      expect(packageTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_lint tool', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const lintTool = tools.find(t => t.tool.name === 'k8s_helm_lint');
      expect(lintTool).toBeDefined();
      expect(lintTool?.tool.description).toBe('Run tests to examine a Helm chart and identify possible issues');
      expect(lintTool?.tool.inputSchema).toBeDefined();
      expect(lintTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_pull tool', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const pullTool = tools.find(t => t.tool.name === 'k8s_helm_pull');
      expect(pullTool).toBeDefined();
      expect(pullTool?.tool.description).toBe('Download/pull a Helm chart from a repository');
      expect(pullTool?.tool.inputSchema).toBeDefined();
      expect(pullTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_verify tool', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const verifyTool = tools.find(t => t.tool.name === 'k8s_helm_verify');
      expect(verifyTool).toBeDefined();
      expect(verifyTool?.tool.description).toBe('Verify that a chart has been signed and is valid');
      expect(verifyTool?.tool.inputSchema).toBeDefined();
      expect(verifyTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_create', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const createTool = tools.find(t => t.tool.name === 'k8s_helm_create');
      const schema = createTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.starter).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_helm_package', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const packageTool = tools.find(t => t.tool.name === 'k8s_helm_package');
      const schema = packageTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chartPath).toBeDefined();
      expect(schema?.properties?.destination).toBeDefined();
      expect(schema?.properties?.sign).toBeDefined();
      expect(schema?.properties?.version).toBeDefined();
      expect(schema?.required).toContain('chartPath');
    });

    it('should have valid input schema for k8s_helm_lint', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const lintTool = tools.find(t => t.tool.name === 'k8s_helm_lint');
      const schema = lintTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.strict).toBeDefined();
      expect(schema?.properties?.quiet).toBeDefined();
      expect(schema?.properties?.values).toBeDefined();
      expect(schema?.required).toContain('chart');
    });

    it('should have valid input schema for k8s_helm_pull', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const pullTool = tools.find(t => t.tool.name === 'k8s_helm_pull');
      const schema = pullTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.version).toBeDefined();
      expect(schema?.properties?.untar).toBeDefined();
      expect(schema?.properties?.destination).toBeDefined();
      expect(schema?.required).toContain('chart');
    });

    it('should have valid input schema for k8s_helm_verify', () => {
      const tools = registerHelmChartManagementTools(mockK8sClient);
      const verifyTool = tools.find(t => t.tool.name === 'k8s_helm_verify');
      const schema = verifyTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chartPath).toBeDefined();
      expect(schema?.properties?.keyring).toBeDefined();
      expect(schema?.required).toContain('chartPath');
    });
  });
});
