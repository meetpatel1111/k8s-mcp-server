import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerSecurityTools } from '../k8s-tools/security.js';
import { K8sClient } from '../k8s-client.js';

describe('Security Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerSecurityTools', () => {
    it('should register security tools', () => {
      const tools = registerSecurityTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_serviceaccounts tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const listServiceAccountsTool = tools.find(t => t.tool.name === 'k8s_list_serviceaccounts');
      expect(listServiceAccountsTool).toBeDefined();
      expect(listServiceAccountsTool?.tool.description).toBe('List all ServiceAccounts');
      expect(listServiceAccountsTool?.tool.inputSchema).toBeDefined();
      expect(listServiceAccountsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_roles tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const listRolesTool = tools.find(t => t.tool.name === 'k8s_list_roles');
      expect(listRolesTool).toBeDefined();
      expect(listRolesTool?.tool.description).toBe('List all Roles');
      expect(listRolesTool?.tool.inputSchema).toBeDefined();
      expect(listRolesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_clusterroles tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const listClusterRolesTool = tools.find(t => t.tool.name === 'k8s_list_clusterroles');
      expect(listClusterRolesTool).toBeDefined();
      expect(listClusterRolesTool?.tool.description).toBe('List all ClusterRoles');
      expect(listClusterRolesTool?.tool.inputSchema).toBeDefined();
      expect(listClusterRolesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_rolebindings tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const listRoleBindingsTool = tools.find(t => t.tool.name === 'k8s_list_rolebindings');
      expect(listRoleBindingsTool).toBeDefined();
      expect(listRoleBindingsTool?.tool.description).toBe('List all RoleBindings');
      expect(listRoleBindingsTool?.tool.inputSchema).toBeDefined();
      expect(listRoleBindingsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_clusterrolebindings tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const listClusterRoleBindingsTool = tools.find(t => t.tool.name === 'k8s_list_clusterrolebindings');
      expect(listClusterRoleBindingsTool).toBeDefined();
      expect(listClusterRoleBindingsTool?.tool.description).toBe('List all ClusterRoleBindings');
      expect(listClusterRoleBindingsTool?.tool.inputSchema).toBeDefined();
      expect(listClusterRoleBindingsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_serviceaccount tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getServiceAccountTool = tools.find(t => t.tool.name === 'k8s_get_serviceaccount');
      expect(getServiceAccountTool).toBeDefined();
      expect(getServiceAccountTool?.tool.description).toBe('Get detailed information about a ServiceAccount');
      expect(getServiceAccountTool?.tool.inputSchema).toBeDefined();
      expect(getServiceAccountTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_role tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getRoleTool = tools.find(t => t.tool.name === 'k8s_get_role');
      expect(getRoleTool).toBeDefined();
      expect(getRoleTool?.tool.description).toBe('Get detailed information about a Role');
      expect(getRoleTool?.tool.inputSchema).toBeDefined();
      expect(getRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_clusterrole tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getClusterRoleTool = tools.find(t => t.tool.name === 'k8s_get_clusterrole');
      expect(getClusterRoleTool).toBeDefined();
      expect(getClusterRoleTool?.tool.description).toBe('Get detailed information about a ClusterRole');
      expect(getClusterRoleTool?.tool.inputSchema).toBeDefined();
      expect(getClusterRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_rolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getRoleBindingTool = tools.find(t => t.tool.name === 'k8s_get_rolebinding');
      expect(getRoleBindingTool).toBeDefined();
      expect(getRoleBindingTool?.tool.description).toBe('Get detailed information about a RoleBinding');
      expect(getRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(getRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_clusterrolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getClusterRoleBindingTool = tools.find(t => t.tool.name === 'k8s_get_clusterrolebinding');
      expect(getClusterRoleBindingTool).toBeDefined();
      expect(getClusterRoleBindingTool?.tool.description).toBe('Get detailed information about a ClusterRoleBinding');
      expect(getClusterRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(getClusterRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_role tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createRoleTool = tools.find(t => t.tool.name === 'k8s_create_role');
      expect(createRoleTool).toBeDefined();
      expect(createRoleTool?.tool.description).toBe('Create a Kubernetes Role (namespaced permissions)');
      expect(createRoleTool?.tool.inputSchema).toBeDefined();
      expect(createRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_clusterrole tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createClusterRoleTool = tools.find(t => t.tool.name === 'k8s_create_clusterrole');
      expect(createClusterRoleTool).toBeDefined();
      expect(createClusterRoleTool?.tool.description).toBe('Create a Kubernetes ClusterRole (cluster-wide permissions)');
      expect(createClusterRoleTool?.tool.inputSchema).toBeDefined();
      expect(createClusterRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_rolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createRoleBindingTool = tools.find(t => t.tool.name === 'k8s_create_rolebinding');
      expect(createRoleBindingTool).toBeDefined();
      expect(createRoleBindingTool?.tool.description).toBe('Create a Kubernetes RoleBinding (binds Role to users/groups/serviceaccounts)');
      expect(createRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(createRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_clusterrolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createClusterRoleBindingTool = tools.find(t => t.tool.name === 'k8s_create_clusterrolebinding');
      expect(createClusterRoleBindingTool).toBeDefined();
      expect(createClusterRoleBindingTool?.tool.description).toBe('Create a Kubernetes ClusterRoleBinding (binds ClusterRole to users/groups/serviceaccounts cluster-wide)');
      expect(createClusterRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(createClusterRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_serviceaccount tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createServiceAccountTool = tools.find(t => t.tool.name === 'k8s_create_serviceaccount');
      expect(createServiceAccountTool).toBeDefined();
      expect(createServiceAccountTool?.tool.description).toBe('Create a Kubernetes ServiceAccount');
      expect(createServiceAccountTool?.tool.inputSchema).toBeDefined();
      expect(createServiceAccountTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_role tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const deleteRoleTool = tools.find(t => t.tool.name === 'k8s_delete_role');
      expect(deleteRoleTool).toBeDefined();
      expect(deleteRoleTool?.tool.description).toBe('Delete a Role');
      expect(deleteRoleTool?.tool.inputSchema).toBeDefined();
      expect(deleteRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_clusterrole tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const deleteClusterRoleTool = tools.find(t => t.tool.name === 'k8s_delete_clusterrole');
      expect(deleteClusterRoleTool).toBeDefined();
      expect(deleteClusterRoleTool?.tool.description).toBe('Delete a ClusterRole');
      expect(deleteClusterRoleTool?.tool.inputSchema).toBeDefined();
      expect(deleteClusterRoleTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_rolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const deleteRoleBindingTool = tools.find(t => t.tool.name === 'k8s_delete_rolebinding');
      expect(deleteRoleBindingTool).toBeDefined();
      expect(deleteRoleBindingTool?.tool.description).toBe('Delete a RoleBinding');
      expect(deleteRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(deleteRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_clusterrolebinding tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const deleteClusterRoleBindingTool = tools.find(t => t.tool.name === 'k8s_delete_clusterrolebinding');
      expect(deleteClusterRoleBindingTool).toBeDefined();
      expect(deleteClusterRoleBindingTool?.tool.description).toBe('Delete a ClusterRoleBinding');
      expect(deleteClusterRoleBindingTool?.tool.inputSchema).toBeDefined();
      expect(deleteClusterRoleBindingTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_serviceaccount tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const deleteServiceAccountTool = tools.find(t => t.tool.name === 'k8s_delete_serviceaccount');
      expect(deleteServiceAccountTool).toBeDefined();
      expect(deleteServiceAccountTool?.tool.description).toBe('Delete a ServiceAccount');
      expect(deleteServiceAccountTool?.tool.inputSchema).toBeDefined();
      expect(deleteServiceAccountTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_rbac_summary tool', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getRbacSummaryTool = tools.find(t => t.tool.name === 'k8s_get_rbac_summary');
      expect(getRbacSummaryTool).toBeDefined();
      expect(getRbacSummaryTool?.tool.description).toBe('Get RBAC summary for a user or service account');
      expect(getRbacSummaryTool?.tool.inputSchema).toBeDefined();
      expect(getRbacSummaryTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_get_role', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getRoleTool = tools.find(t => t.tool.name === 'k8s_get_role');
      const schema = getRoleTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_get_clusterrole', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const getClusterRoleTool = tools.find(t => t.tool.name === 'k8s_get_clusterrole');
      const schema = getClusterRoleTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_create_role', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createRoleTool = tools.find(t => t.tool.name === 'k8s_create_role');
      const schema = createRoleTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.rules).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('rules');
    });

    it('should have valid input schema for k8s_create_clusterrole', () => {
      const tools = registerSecurityTools(mockK8sClient);
      const createClusterRoleTool = tools.find(t => t.tool.name === 'k8s_create_clusterrole');
      const schema = createClusterRoleTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.rules).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('rules');
    });
  });
});
