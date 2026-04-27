import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmChartTemplateTools } from '../helm-tools/chart-template.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Chart Template Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmChartTemplateTools', () => {
    it('should register chart template tools', () => {
      const tools = registerHelmChartTemplateTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_template tool', () => {
      const tools = registerHelmChartTemplateTools(mockK8sClient);
      const templateTool = tools.find(t => t.tool.name === 'k8s_helm_template');
      expect(templateTool).toBeDefined();
      expect(templateTool?.tool.description).toBe('Locally render templates for a Helm chart without installing');
      expect(templateTool?.tool.inputSchema).toBeDefined();
      expect(templateTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_template', () => {
      const tools = registerHelmChartTemplateTools(mockK8sClient);
      const templateTool = tools.find(t => t.tool.name === 'k8s_helm_template');
      const schema = templateTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.version).toBeDefined();
      expect(schema?.properties?.values).toBeDefined();
      expect(schema?.properties?.set).toBeDefined();
      expect(schema?.properties?.includeCRDs).toBeDefined();
      expect(schema?.properties?.skipTests).toBeDefined();
      expect(schema?.properties?.validate).toBeDefined();
      expect(schema?.required).toContain('chart');
    });
  });
});
