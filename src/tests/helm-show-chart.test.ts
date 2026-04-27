import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmShowChartTools } from '../helm-tools/show-chart.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Show Chart Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmShowChartTools', () => {
    it('should register show chart tools', () => {
      const tools = registerHelmShowChartTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_show tool', () => {
      const tools = registerHelmShowChartTools(mockK8sClient);
      const showTool = tools.find(t => t.tool.name === 'k8s_helm_show');
      expect(showTool).toBeDefined();
      expect(showTool?.tool.description).toBe('Show information about a Helm chart (like helm show chart/values/readme)');
      expect(showTool?.tool.inputSchema).toBeDefined();
      expect(showTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_show', () => {
      const tools = registerHelmShowChartTools(mockK8sClient);
      const showTool = tools.find(t => t.tool.name === 'k8s_helm_show');
      const schema = showTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.chart).toBeDefined();
      expect(schema?.required).toContain('chart');
    });
  });
});
