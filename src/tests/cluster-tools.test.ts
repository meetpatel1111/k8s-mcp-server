import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerClusterTools } from '../k8s-tools/cluster.js';
import { K8sClient } from '../k8s-client.js';

describe('Cluster Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerClusterTools', () => {
    it('should register cluster tools', () => {
      const tools = registerClusterTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_contexts tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const listContextsTool = tools.find(t => t.tool.name === 'k8s_list_contexts');
      expect(listContextsTool).toBeDefined();
      expect(listContextsTool?.tool.description).toBe('List all available Kubernetes contexts from kubeconfig');
      expect(listContextsTool?.tool.inputSchema).toBeDefined();
      expect(listContextsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_switch_context tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const switchContextTool = tools.find(t => t.tool.name === 'k8s_switch_context');
      expect(switchContextTool).toBeDefined();
      expect(switchContextTool?.tool.description).toBe('Switch to a different Kubernetes context');
      expect(switchContextTool?.tool.inputSchema).toBeDefined();
      expect(switchContextTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cluster_version tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const clusterVersionTool = tools.find(t => t.tool.name === 'k8s_cluster_version');
      expect(clusterVersionTool).toBeDefined();
      expect(clusterVersionTool?.tool.description).toBe('Get Kubernetes cluster version information');
      expect(clusterVersionTool?.tool.inputSchema).toBeDefined();
      expect(clusterVersionTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_component_status tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const componentStatusTool = tools.find(t => t.tool.name === 'k8s_component_status');
      expect(componentStatusTool).toBeDefined();
      expect(componentStatusTool?.tool.description).toBe('Get Kubernetes component statuses (scheduler, controller-manager, etcd)');
      expect(componentStatusTool?.tool.inputSchema).toBeDefined();
      expect(componentStatusTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cluster_health tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const clusterHealthTool = tools.find(t => t.tool.name === 'k8s_cluster_health');
      expect(clusterHealthTool).toBeDefined();
      expect(clusterHealthTool?.tool.description).toBe('Get comprehensive cluster health overview including nodes, pods, and components');
      expect(clusterHealthTool?.tool.inputSchema).toBeDefined();
      expect(clusterHealthTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_namespaces tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const listNamespacesTool = tools.find(t => t.tool.name === 'k8s_list_namespaces');
      expect(listNamespacesTool).toBeDefined();
      expect(listNamespacesTool?.tool.description).toBe('List all namespaces in the cluster');
      expect(listNamespacesTool?.tool.inputSchema).toBeDefined();
      expect(listNamespacesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_api_latency_check tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const apiLatencyTool = tools.find(t => t.tool.name === 'k8s_api_latency_check');
      expect(apiLatencyTool).toBeDefined();
      expect(apiLatencyTool?.tool.description).toBe('Check API server latency and connectivity');
      expect(apiLatencyTool?.tool.inputSchema).toBeDefined();
      expect(apiLatencyTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cluster_info tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const clusterInfoTool = tools.find(t => t.tool.name === 'k8s_cluster_info');
      expect(clusterInfoTool).toBeDefined();
      expect(clusterInfoTool?.tool.description).toBe('Display cluster info (like kubectl cluster-info)');
      expect(clusterInfoTool?.tool.inputSchema).toBeDefined();
      expect(clusterInfoTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_version tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const versionTool = tools.find(t => t.tool.name === 'k8s_version');
      expect(versionTool).toBeDefined();
      expect(versionTool?.tool.description).toBe('Show kubectl and cluster version information (like kubectl version)');
      expect(versionTool?.tool.inputSchema).toBeDefined();
      expect(versionTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_cluster_info_dump tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const dumpTool = tools.find(t => t.tool.name === 'k8s_cluster_info_dump');
      expect(dumpTool).toBeDefined();
      expect(dumpTool?.tool.description).toBe('Dump cluster state for debugging (like kubectl cluster-info dump). Collects information about nodes, pods, services, events, and configuration.');
      expect(dumpTool?.tool.inputSchema).toBeDefined();
      expect(dumpTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_api_versions tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const apiVersionsTool = tools.find(t => t.tool.name === 'k8s_api_versions');
      expect(apiVersionsTool).toBeDefined();
      expect(apiVersionsTool?.tool.description).toBe('List available API versions (like kubectl api-versions)');
      expect(apiVersionsTool?.tool.inputSchema).toBeDefined();
      expect(apiVersionsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_priorityclass tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const priorityClassTool = tools.find(t => t.tool.name === 'k8s_create_priorityclass');
      expect(priorityClassTool).toBeDefined();
      expect(priorityClassTool?.tool.description).toBe('Create a PriorityClass (like kubectl create priorityclass)');
      expect(priorityClassTool?.tool.inputSchema).toBeDefined();
      expect(priorityClassTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_config_delete_context tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const deleteContextTool = tools.find(t => t.tool.name === 'k8s_config_delete_context');
      expect(deleteContextTool).toBeDefined();
      expect(deleteContextTool?.tool.description).toBe('Delete a context from kubeconfig (like kubectl config delete-context)');
      expect(deleteContextTool?.tool.inputSchema).toBeDefined();
      expect(deleteContextTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_config_rename_context tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const renameContextTool = tools.find(t => t.tool.name === 'k8s_config_rename_context');
      expect(renameContextTool).toBeDefined();
      expect(renameContextTool?.tool.description).toBe('Rename a context in kubeconfig (like kubectl config rename-context)');
      expect(renameContextTool?.tool.inputSchema).toBeDefined();
      expect(renameContextTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_runtimeclasses tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const runtimeClassesTool = tools.find(t => t.tool.name === 'k8s_list_runtimeclasses');
      expect(runtimeClassesTool).toBeDefined();
      expect(runtimeClassesTool?.tool.description).toBe('List RuntimeClasses in the cluster (like kubectl get runtimeclass)');
      expect(runtimeClassesTool?.tool.inputSchema).toBeDefined();
      expect(runtimeClassesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_leases tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const leasesTool = tools.find(t => t.tool.name === 'k8s_list_leases');
      expect(leasesTool).toBeDefined();
      expect(leasesTool?.tool.description).toBe('List Lease objects (coordination API, like kubectl get lease)');
      expect(leasesTool?.tool.inputSchema).toBeDefined();
      expect(leasesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_config_set tool', () => {
      const tools = registerClusterTools(mockK8sClient);
      const configSetTool = tools.find(t => t.tool.name === 'k8s_config_set');
      expect(configSetTool).toBeDefined();
      expect(configSetTool?.tool.description).toBe('Set a kubeconfig value (like kubectl config set). Sets a cluster, context, or user property.');
      expect(configSetTool?.tool.inputSchema).toBeDefined();
      expect(configSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_switch_context', () => {
      const tools = registerClusterTools(mockK8sClient);
      const switchContextTool = tools.find(t => t.tool.name === 'k8s_switch_context');
      const schema = switchContextTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.context).toBeDefined();
      expect(schema?.required).toContain('context');
    });

    it('should have valid input schema for k8s_create_priorityclass', () => {
      const tools = registerClusterTools(mockK8sClient);
      const priorityClassTool = tools.find(t => t.tool.name === 'k8s_create_priorityclass');
      const schema = priorityClassTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.value).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('value');
    });
  });
});
