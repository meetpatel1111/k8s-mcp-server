import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerStorageTools } from '../k8s-tools/storage.js';
import { K8sClient } from '../k8s-client.js';

describe('Storage Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerStorageTools', () => {
    it('should register storage tools', () => {
      const tools = registerStorageTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_pvs tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const listPVsTool = tools.find(t => t.tool.name === 'k8s_list_pvs');
      expect(listPVsTool).toBeDefined();
      expect(listPVsTool?.tool.description).toBe('List all PersistentVolumes');
      expect(listPVsTool?.tool.inputSchema).toBeDefined();
      expect(listPVsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_pvcs tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const listPVCsTool = tools.find(t => t.tool.name === 'k8s_list_pvcs');
      expect(listPVCsTool).toBeDefined();
      expect(listPVCsTool?.tool.description).toBe('List all PersistentVolumeClaims');
      expect(listPVCsTool?.tool.inputSchema).toBeDefined();
      expect(listPVCsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_storageclasses tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const listStorageClassesTool = tools.find(t => t.tool.name === 'k8s_list_storageclasses');
      expect(listStorageClassesTool).toBeDefined();
      expect(listStorageClassesTool?.tool.description).toBe('List all StorageClasses');
      expect(listStorageClassesTool?.tool.inputSchema).toBeDefined();
      expect(listStorageClassesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_pv tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getPVTool = tools.find(t => t.tool.name === 'k8s_get_pv');
      expect(getPVTool).toBeDefined();
      expect(getPVTool?.tool.description).toBe('Get detailed information about a PersistentVolume');
      expect(getPVTool?.tool.inputSchema).toBeDefined();
      expect(getPVTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_storageclass tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getStorageClassTool = tools.find(t => t.tool.name === 'k8s_get_storageclass');
      expect(getStorageClassTool).toBeDefined();
      expect(getStorageClassTool?.tool.description).toBe('Get detailed information about a StorageClass');
      expect(getStorageClassTool?.tool.inputSchema).toBeDefined();
      expect(getStorageClassTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_pvc_details tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getPVCDetailsTool = tools.find(t => t.tool.name === 'k8s_get_pvc_details');
      expect(getPVCDetailsTool).toBeDefined();
      expect(getPVCDetailsTool?.tool.description).toBe('Get detailed information about a PVC including events');
      expect(getPVCDetailsTool?.tool.inputSchema).toBeDefined();
      expect(getPVCDetailsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_find_unbound_pvcs tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const findUnboundPVCTool = tools.find(t => t.tool.name === 'k8s_find_unbound_pvcs');
      expect(findUnboundPVCTool).toBeDefined();
      expect(findUnboundPVCTool?.tool.description).toBe('Find PVCs that are not bound to a PV');
      expect(findUnboundPVCTool?.tool.inputSchema).toBeDefined();
      expect(findUnboundPVCTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_storage_summary tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const storageSummaryTool = tools.find(t => t.tool.name === 'k8s_storage_summary');
      expect(storageSummaryTool).toBeDefined();
      expect(storageSummaryTool?.tool.description).toBe('Get cluster-wide storage summary');
      expect(storageSummaryTool?.tool.inputSchema).toBeDefined();
      expect(storageSummaryTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_pvc tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const deletePVCTool = tools.find(t => t.tool.name === 'k8s_delete_pvc');
      expect(deletePVCTool).toBeDefined();
      expect(deletePVCTool?.tool.description).toBe('Delete a PersistentVolumeClaim');
      expect(deletePVCTool?.tool.inputSchema).toBeDefined();
      expect(deletePVCTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_pvc tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const createPVCTool = tools.find(t => t.tool.name === 'k8s_create_pvc');
      expect(createPVCTool).toBeDefined();
      expect(createPVCTool?.tool.description).toBe('Create a PersistentVolumeClaim (like kubectl create pvc or apply -f pvc.yaml)');
      expect(createPVCTool?.tool.inputSchema).toBeDefined();
      expect(createPVCTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_pv tool', () => {
      const tools = registerStorageTools(mockK8sClient);
      const createPVTool = tools.find(t => t.tool.name === 'k8s_create_pv');
      expect(createPVTool).toBeDefined();
      expect(createPVTool?.tool.description).toBe('Create a PersistentVolume (cluster admin operation, like kubectl create pv or apply -f pv.yaml)');
      expect(createPVTool?.tool.inputSchema).toBeDefined();
      expect(createPVTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_get_pv', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getPVTool = tools.find(t => t.tool.name === 'k8s_get_pv');
      const schema = getPVTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_get_storageclass', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getStorageClassTool = tools.find(t => t.tool.name === 'k8s_get_storageclass');
      const schema = getStorageClassTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_get_pvc_details', () => {
      const tools = registerStorageTools(mockK8sClient);
      const getPVCDetailsTool = tools.find(t => t.tool.name === 'k8s_get_pvc_details');
      const schema = getPVCDetailsTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_create_pvc', () => {
      const tools = registerStorageTools(mockK8sClient);
      const createPVCTool = tools.find(t => t.tool.name === 'k8s_create_pvc');
      const schema = createPVCTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.size).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('size');
    });

    it('should have valid input schema for k8s_create_pv', () => {
      const tools = registerStorageTools(mockK8sClient);
      const createPVTool = tools.find(t => t.tool.name === 'k8s_create_pv');
      const schema = createPVTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.capacity).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('capacity');
    });

    it('should have valid input schema for k8s_delete_pvc', () => {
      const tools = registerStorageTools(mockK8sClient);
      const deletePVCTool = tools.find(t => t.tool.name === 'k8s_delete_pvc');
      const schema = deletePVCTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.gracePeriodSeconds).toBeDefined();
      expect(schema?.required).toContain('name');
    });
  });
});
