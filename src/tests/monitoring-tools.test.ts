import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerMonitoringTools } from '../k8s-tools/monitoring.js';
import { K8sClient } from '../k8s-client.js';

describe('Monitoring Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerMonitoringTools', () => {
    it('should register monitoring tools', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_events tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const listEventsTool = tools.find(t => t.tool.name === 'k8s_list_events');
      expect(listEventsTool).toBeDefined();
      expect(listEventsTool?.tool.description).toBe('List cluster events');
      expect(listEventsTool?.tool.inputSchema).toBeDefined();
      expect(listEventsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_resource_quotas tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const getResourceQuotasTool = tools.find(t => t.tool.name === 'k8s_get_resource_quotas');
      expect(getResourceQuotasTool).toBeDefined();
      expect(getResourceQuotasTool?.tool.description).toBe('List ResourceQuotas per namespace');
      expect(getResourceQuotasTool?.tool.inputSchema).toBeDefined();
      expect(getResourceQuotasTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_limit_ranges tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const getLimitRangesTool = tools.find(t => t.tool.name === 'k8s_get_limit_ranges');
      expect(getLimitRangesTool).toBeDefined();
      expect(getLimitRangesTool?.tool.description).toBe('List LimitRanges per namespace');
      expect(getLimitRangesTool?.tool.inputSchema).toBeDefined();
      expect(getLimitRangesTool?.handler).toBeInstanceOf(Function);
    });



    it('should register k8s_top_pod tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const topPodTool = tools.find(t => t.tool.name === 'k8s_top_pod');
      expect(topPodTool).toBeDefined();
      expect(topPodTool?.tool.description).toBe('Display resource usage (CPU/Memory) for pods (like kubectl top pod). Requires metrics-server.');
      expect(topPodTool?.tool.inputSchema).toBeDefined();
      expect(topPodTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_top_node tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const topNodeTool = tools.find(t => t.tool.name === 'k8s_top_node');
      expect(topNodeTool).toBeDefined();
      expect(topNodeTool?.tool.description).toBe('Display resource usage (CPU/Memory) for nodes (like kubectl top node). Requires metrics-server.');
      expect(topNodeTool?.tool.inputSchema).toBeDefined();
      expect(topNodeTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_pod_metrics tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const getPodMetricsTool = tools.find(t => t.tool.name === 'k8s_get_pod_metrics');
      expect(getPodMetricsTool).toBeDefined();
      expect(getPodMetricsTool?.tool.description).toBe('Get pod metrics (CPU/Memory) - requires metrics-server');
      expect(getPodMetricsTool?.tool.inputSchema).toBeDefined();
      expect(getPodMetricsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_node_metrics tool', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const getNodeMetricsTool = tools.find(t => t.tool.name === 'k8s_get_node_metrics');
      expect(getNodeMetricsTool).toBeDefined();
      expect(getNodeMetricsTool?.tool.description).toBe('Get node metrics (CPU/Memory) - requires metrics-server');
      expect(getNodeMetricsTool?.tool.inputSchema).toBeDefined();
      expect(getNodeMetricsTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_list_events', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const listEventsTool = tools.find(t => t.tool.name === 'k8s_list_events');
      const schema = listEventsTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.fieldSelector).toBeDefined();
      expect(schema?.properties?.type).toBeDefined();
    });


    it('should have valid input schema for k8s_top_pod', () => {
      const tools = registerMonitoringTools(mockK8sClient);
      const topPodTool = tools.find(t => t.tool.name === 'k8s_top_pod');
      const schema = topPodTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.sortBy).toBeDefined();
    });
  });
});
