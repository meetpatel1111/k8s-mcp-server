import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerAdvancedTools } from '../k8s-tools/advanced.js';
import { K8sClient } from '../k8s-client.js';
import { CacheManager } from '../cache-manager.js';

describe('Advanced Tools', () => {
  let mockK8sClient: K8sClient;
  let mockCacheManager: CacheManager;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
    mockCacheManager = new CacheManager();
  });

  describe('registerAdvancedTools', () => {
    it('should register advanced tools', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_cache_stats tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const cacheStatsTool = tools.find(t => t.tool.name === 'k8s_cache_stats');
      expect(cacheStatsTool).toBeDefined();
      expect(cacheStatsTool?.tool.description).toBe('Get cache statistics including hit rate, miss rate, and total requests. Provides visibility into cache effectiveness.');
      expect(cacheStatsTool?.tool.inputSchema).toBeDefined();
      expect(cacheStatsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cache_clear tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const cacheClearTool = tools.find(t => t.tool.name === 'k8s_cache_clear');
      expect(cacheClearTool).toBeDefined();
      expect(cacheClearTool?.tool.description).toBe('Clear all cached entries and reset statistics. Use this to force fresh data retrieval.');
      expect(cacheClearTool?.tool.inputSchema).toBeDefined();
      expect(cacheClearTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_batch_get_resources tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const batchGetResourcesTool = tools.find(t => t.tool.name === 'k8s_batch_get_resources');
      expect(batchGetResourcesTool).toBeDefined();
      expect(batchGetResourcesTool?.tool.description).toBe('Get multiple Kubernetes resources in parallel for improved performance. Supports Pod, Deployment, Service, ConfigMap, Secret, Node, Namespace, StatefulSet, DaemonSet, Job, CronJob, Ingress, PVC, PV, StorageClass, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding.');
      expect(batchGetResourcesTool?.tool.inputSchema).toBeDefined();
      expect(batchGetResourcesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_kubectl tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const kubectlTool = tools.find(t => t.tool.name === 'k8s_kubectl');
      expect(kubectlTool).toBeDefined();
      expect(kubectlTool?.tool.description).toBe('Execute arbitrary kubectl command (fallback for unsupported operations). Use with caution - this is a generic tool for commands not covered by specific tools.');
      expect(kubectlTool?.tool.inputSchema).toBeDefined();
      expect(kubectlTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_raw_api_query tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const rawApiQueryTool = tools.find(t => t.tool.name === 'k8s_raw_api_query');
      expect(rawApiQueryTool).toBeDefined();
      expect(rawApiQueryTool?.tool.description).toBe('Execute a raw API query against the Kubernetes API server');
      expect(rawApiQueryTool?.tool.inputSchema).toBeDefined();
      expect(rawApiQueryTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_analyze_pod_failure tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const analyzePodFailureTool = tools.find(t => t.tool.name === 'k8s_analyze_pod_failure');
      expect(analyzePodFailureTool).toBeDefined();
      expect(analyzePodFailureTool?.tool.description).toBe('AI-style diagnosis of why a pod is failing');
      expect(analyzePodFailureTool?.tool.inputSchema).toBeDefined();
      expect(analyzePodFailureTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_suggest_optimizations tool', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const suggestOptimizationsTool = tools.find(t => t.tool.name === 'k8s_suggest_optimizations');
      expect(suggestOptimizationsTool).toBeDefined();
      expect(suggestOptimizationsTool?.tool.description).toBe('Analyze resources and suggest optimizations');
      expect(suggestOptimizationsTool?.tool.inputSchema).toBeDefined();
      expect(suggestOptimizationsTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_batch_get_resources', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const batchGetResourcesTool = tools.find(t => t.tool.name === 'k8s_batch_get_resources');
      const schema = batchGetResourcesTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.resources).toBeDefined();
      expect(schema?.required).toContain('resources');
    });

    it('should have valid input schema for k8s_kubectl', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const kubectlTool = tools.find(t => t.tool.name === 'k8s_kubectl');
      const schema = kubectlTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.command).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.context).toBeDefined();
      expect(schema?.required).toContain('command');
    });

    it('should have valid input schema for k8s_raw_api_query', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const rawApiQueryTool = tools.find(t => t.tool.name === 'k8s_raw_api_query');
      const schema = rawApiQueryTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.path).toBeDefined();
      expect(schema?.required).toContain('path');
    });

    it('should have valid input schema for k8s_analyze_pod_failure', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const analyzePodFailureTool = tools.find(t => t.tool.name === 'k8s_analyze_pod_failure');
      const schema = analyzePodFailureTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_suggest_optimizations', () => {
      const tools = registerAdvancedTools(mockK8sClient, mockCacheManager);
      const suggestOptimizationsTool = tools.find(t => t.tool.name === 'k8s_suggest_optimizations');
      const schema = suggestOptimizationsTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
    });
  });
});
