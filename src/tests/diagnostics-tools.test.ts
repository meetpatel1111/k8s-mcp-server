import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerDiagnosticsTools } from '../k8s-tools/diagnostics.js';
import { K8sClient } from '../k8s-client.js';

describe('Diagnostics Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerDiagnosticsTools', () => {
    it('should register diagnostics tools', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_namespace_summary tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const namespaceSummaryTool = tools.find(t => t.tool.name === 'k8s_namespace_summary');
      expect(namespaceSummaryTool).toBeDefined();
      expect(namespaceSummaryTool?.tool.description).toBe('Get a comprehensive summary of all resources in a namespace - pods, deployments, services, configmaps, secrets, jobs, and resource usage at a glance');
      expect(namespaceSummaryTool?.tool.inputSchema).toBeDefined();
      expect(namespaceSummaryTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_resource_age_report tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const resourceAgeReportTool = tools.find(t => t.tool.name === 'k8s_resource_age_report');
      expect(resourceAgeReportTool).toBeDefined();
      expect(resourceAgeReportTool?.tool.description).toBe('Find old, stale, or long-running resources. Helps identify resources that may need cleanup or attention.');
      expect(resourceAgeReportTool?.tool.inputSchema).toBeDefined();
      expect(resourceAgeReportTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_pod_log_search tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const podLogSearchTool = tools.find(t => t.tool.name === 'k8s_pod_log_search');
      expect(podLogSearchTool).toBeDefined();
      expect(podLogSearchTool?.tool.description).toBe('Search for patterns in pod logs across multiple pods. Useful for finding errors, exceptions, or specific messages.');
      expect(podLogSearchTool?.tool.inputSchema).toBeDefined();
      expect(podLogSearchTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_resource_comparison tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const resourceComparisonTool = tools.find(t => t.tool.name === 'k8s_resource_comparison');
      expect(resourceComparisonTool).toBeDefined();
      expect(resourceComparisonTool?.tool.description).toBe('Compare resource counts and status across two namespaces. Useful for verifying staging/production parity.');
      expect(resourceComparisonTool?.tool.inputSchema).toBeDefined();
      expect(resourceComparisonTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_container_image_report tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const containerImageReportTool = tools.find(t => t.tool.name === 'k8s_container_image_report');
      expect(containerImageReportTool).toBeDefined();
      expect(containerImageReportTool?.tool.description).toBe('Report on all container images used in the cluster. Helps audit image versions, find outdated images, and identify tag usage.');
      expect(containerImageReportTool?.tool.inputSchema).toBeDefined();
      expect(containerImageReportTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_restart_report tool', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const restartReportTool = tools.find(t => t.tool.name === 'k8s_restart_report');
      expect(restartReportTool).toBeDefined();
      expect(restartReportTool?.tool.description).toBe('Report on container restarts across the cluster. Identifies containers that are frequently restarting.');
      expect(restartReportTool?.tool.inputSchema).toBeDefined();
      expect(restartReportTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_namespace_summary', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const namespaceSummaryTool = tools.find(t => t.tool.name === 'k8s_namespace_summary');
      const schema = namespaceSummaryTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
    });

    it('should have valid input schema for k8s_resource_age_report', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const resourceAgeReportTool = tools.find(t => t.tool.name === 'k8s_resource_age_report');
      const schema = resourceAgeReportTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.olderThanDays).toBeDefined();
      expect(schema?.properties?.resourceTypes).toBeDefined();
    });

    it('should have valid input schema for k8s_pod_log_search', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const podLogSearchTool = tools.find(t => t.tool.name === 'k8s_pod_log_search');
      const schema = podLogSearchTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.pattern).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.labelSelector).toBeDefined();
      expect(schema?.properties?.tailLines).toBeDefined();
      expect(schema?.properties?.maxPods).toBeDefined();
      expect(schema?.required).toContain('pattern');
    });

    it('should have valid input schema for k8s_resource_comparison', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const resourceComparisonTool = tools.find(t => t.tool.name === 'k8s_resource_comparison');
      const schema = resourceComparisonTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace1).toBeDefined();
      expect(schema?.properties?.namespace2).toBeDefined();
      expect(schema?.required).toContain('namespace1');
      expect(schema?.required).toContain('namespace2');
    });

    it('should have valid input schema for k8s_container_image_report', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const containerImageReportTool = tools.find(t => t.tool.name === 'k8s_container_image_report');
      const schema = containerImageReportTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.filter).toBeDefined();
    });

    it('should have valid input schema for k8s_restart_report', () => {
      const tools = registerDiagnosticsTools(mockK8sClient);
      const restartReportTool = tools.find(t => t.tool.name === 'k8s_restart_report');
      const schema = restartReportTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.minRestarts).toBeDefined();
    });
  });
});
