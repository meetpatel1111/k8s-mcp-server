import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerTemplateTools } from '../k8s-tools/templates.js';
import { K8sClient } from '../k8s-client.js';

describe('Templates Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerTemplateTools', () => {
    it('should register template tools', () => {
      const tools = registerTemplateTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_get_deployment_templates tool', () => {
      const tools = registerTemplateTools(mockK8sClient);
      const getDeploymentTemplatesTool = tools.find(t => t.tool.name === 'k8s_get_deployment_templates');
      expect(getDeploymentTemplatesTool).toBeDefined();
      expect(getDeploymentTemplatesTool?.tool.description).toBe('Get common deployment templates for quick deployment');
      expect(getDeploymentTemplatesTool?.tool.inputSchema).toBeDefined();
      expect(getDeploymentTemplatesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_quick_deploy tool', () => {
      const tools = registerTemplateTools(mockK8sClient);
      const quickDeployTool = tools.find(t => t.tool.name === 'k8s_quick_deploy');
      expect(quickDeployTool).toBeDefined();
      expect(quickDeployTool?.tool.description).toBe('Quick deploy using template with custom parameters');
      expect(quickDeployTool?.tool.inputSchema).toBeDefined();
      expect(quickDeployTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_get_deployment_templates', () => {
      const tools = registerTemplateTools(mockK8sClient);
      const getDeploymentTemplatesTool = tools.find(t => t.tool.name === 'k8s_get_deployment_templates');
      const schema = getDeploymentTemplatesTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.category).toBeDefined();
    });

    it('should have valid input schema for k8s_quick_deploy', () => {
      const tools = registerTemplateTools(mockK8sClient);
      const quickDeployTool = tools.find(t => t.tool.name === 'k8s_quick_deploy');
      const schema = quickDeployTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.template).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.image).toBeDefined();
      expect(schema?.properties?.replicas).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.resources).toBeDefined();
      expect(schema?.required).toContain('template');
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('image');
    });
  });
});
