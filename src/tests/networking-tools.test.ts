import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerNetworkingTools } from '../k8s-tools/networking.js';
import { K8sClient } from '../k8s-client.js';

describe('Networking Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerNetworkingTools', () => {
    it('should register networking tools', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_services tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const listServicesTool = tools.find(t => t.tool.name === 'k8s_list_services');
      expect(listServicesTool).toBeDefined();
      expect(listServicesTool?.tool.description).toBe('List all services');
      expect(listServicesTool?.tool.inputSchema).toBeDefined();
      expect(listServicesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_service tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const getServiceTool = tools.find(t => t.tool.name === 'k8s_get_service');
      expect(getServiceTool).toBeDefined();
      expect(getServiceTool?.tool.description).toBe('Get detailed information about a Service');
      expect(getServiceTool?.tool.inputSchema).toBeDefined();
      expect(getServiceTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_service tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const createServiceTool = tools.find(t => t.tool.name === 'k8s_create_service');
      expect(createServiceTool).toBeDefined();
      expect(createServiceTool?.tool.description).toBe('Create a new Kubernetes Service');
      expect(createServiceTool?.tool.inputSchema).toBeDefined();
      expect(createServiceTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_service tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const deleteServiceTool = tools.find(t => t.tool.name === 'k8s_delete_service');
      expect(deleteServiceTool).toBeDefined();
      expect(deleteServiceTool?.tool.description).toBe('Delete a Service');
      expect(deleteServiceTool?.tool.inputSchema).toBeDefined();
      expect(deleteServiceTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_service_endpoints tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const getEndpointsTool = tools.find(t => t.tool.name === 'k8s_get_service_endpoints');
      expect(getEndpointsTool).toBeDefined();
      expect(getEndpointsTool?.tool.description).toBe('Get endpoints for a service');
      expect(getEndpointsTool?.tool.inputSchema).toBeDefined();
      expect(getEndpointsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_ingresses tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const listIngressesTool = tools.find(t => t.tool.name === 'k8s_list_ingresses');
      expect(listIngressesTool).toBeDefined();
      expect(listIngressesTool?.tool.description).toBe('List all Ingresses');
      expect(listIngressesTool?.tool.inputSchema).toBeDefined();
      expect(listIngressesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_ingress tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const getIngressTool = tools.find(t => t.tool.name === 'k8s_get_ingress');
      expect(getIngressTool).toBeDefined();
      expect(getIngressTool?.tool.description).toBe('Get detailed information about an Ingress');
      expect(getIngressTool?.tool.inputSchema).toBeDefined();
      expect(getIngressTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_ingress tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const createIngressTool = tools.find(t => t.tool.name === 'k8s_create_ingress');
      expect(createIngressTool).toBeDefined();
      expect(createIngressTool?.tool.description).toBe('Create a new Kubernetes Ingress');
      expect(createIngressTool?.tool.inputSchema).toBeDefined();
      expect(createIngressTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_ingress tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const deleteIngressTool = tools.find(t => t.tool.name === 'k8s_delete_ingress');
      expect(deleteIngressTool).toBeDefined();
      expect(deleteIngressTool?.tool.description).toBe('Delete an Ingress');
      expect(deleteIngressTool?.tool.inputSchema).toBeDefined();
      expect(deleteIngressTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_network_policies tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const listNetworkPoliciesTool = tools.find(t => t.tool.name === 'k8s_list_network_policies');
      expect(listNetworkPoliciesTool).toBeDefined();
      expect(listNetworkPoliciesTool?.tool.description).toBe('List all NetworkPolicies');
      expect(listNetworkPoliciesTool?.tool.inputSchema).toBeDefined();
      expect(listNetworkPoliciesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_network_policy tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const getNetworkPolicyTool = tools.find(t => t.tool.name === 'k8s_get_network_policy');
      expect(getNetworkPolicyTool).toBeDefined();
      expect(getNetworkPolicyTool?.tool.description).toBe('Get detailed information about a NetworkPolicy');
      expect(getNetworkPolicyTool?.tool.inputSchema).toBeDefined();
      expect(getNetworkPolicyTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_networkpolicy tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const createNetworkPolicyTool = tools.find(t => t.tool.name === 'k8s_create_networkpolicy');
      expect(createNetworkPolicyTool).toBeDefined();
      expect(createNetworkPolicyTool?.tool.description).toBe('Create a Kubernetes NetworkPolicy to control traffic flow');
      expect(createNetworkPolicyTool?.tool.inputSchema).toBeDefined();
      expect(createNetworkPolicyTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_expose tool', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const exposeTool = tools.find(t => t.tool.name === 'k8s_expose');
      expect(exposeTool).toBeDefined();
      expect(exposeTool?.tool.description).toBe('Expose a deployment or pod as a service (like kubectl expose)');
      expect(exposeTool?.tool.inputSchema).toBeDefined();
      expect(exposeTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_get_service', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const getServiceTool = tools.find(t => t.tool.name === 'k8s_get_service');
      const schema = getServiceTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_create_service', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const createServiceTool = tools.find(t => t.tool.name === 'k8s_create_service');
      const schema = createServiceTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.ports).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('ports');
    });

    it('should have valid input schema for k8s_create_ingress', () => {
      const tools = registerNetworkingTools(mockK8sClient);
      const createIngressTool = tools.find(t => t.tool.name === 'k8s_create_ingress');
      const schema = createIngressTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.rules).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('rules');
    });
  });
});
