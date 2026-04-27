import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerConfigTools } from '../k8s-tools/config.js';
import { K8sClient } from '../k8s-client.js';

describe('Config Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerConfigTools', () => {
    it('should register config tools', () => {
      const tools = registerConfigTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_apply_manifest tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const applyManifestTool = tools.find(t => t.tool.name === 'k8s_apply_manifest');
      expect(applyManifestTool).toBeDefined();
      expect(applyManifestTool?.tool.description).toBe('Apply a Kubernetes manifest (YAML or JSON)');
      expect(applyManifestTool?.tool.inputSchema).toBeDefined();
      expect(applyManifestTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_export_resource tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const exportResourceTool = tools.find(t => t.tool.name === 'k8s_export_resource');
      expect(exportResourceTool).toBeDefined();
      expect(exportResourceTool?.tool.description).toBe('Export a resource as YAML');
      expect(exportResourceTool?.tool.inputSchema).toBeDefined();
      expect(exportResourceTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_diff tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const diffTool = tools.find(t => t.tool.name === 'k8s_diff');
      expect(diffTool).toBeDefined();
      expect(diffTool?.tool.description).toBe('Diff a file or manifest against the live configuration (like kubectl diff). Shows differences between local manifest and running resource.');
      expect(diffTool?.tool.inputSchema).toBeDefined();
      expect(diffTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_edit tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const editTool = tools.find(t => t.tool.name === 'k8s_edit');
      expect(editTool).toBeDefined();
      expect(editTool?.tool.description).toBe('Get a resource for editing and apply changes (like kubectl edit). Step 1: Call without \'manifest\' to get current YAML. Step 2: Call with modified \'manifest\' to apply changes.');
      expect(editTool?.tool.inputSchema).toBeDefined();
      expect(editTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_convert tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const convertTool = tools.find(t => t.tool.name === 'k8s_convert');
      expect(convertTool).toBeDefined();
      expect(convertTool?.tool.description).toBe('Convert a manifest between different API versions (like kubectl convert). Note: Uses best-effort heuristic conversion.');
      expect(convertTool?.tool.inputSchema).toBeDefined();
      expect(convertTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_kustomize_build tool', () => {
      const tools = registerConfigTools(mockK8sClient);
      const kustomizeTool = tools.find(t => t.tool.name === 'k8s_kustomize_build');
      expect(kustomizeTool).toBeDefined();
      expect(kustomizeTool?.tool.description).toBe('Build Kubernetes manifests from a kustomization directory (like kubectl kustomize)');
      expect(kustomizeTool?.tool.inputSchema).toBeDefined();
      expect(kustomizeTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_apply_manifest', () => {
      const tools = registerConfigTools(mockK8sClient);
      const applyManifestTool = tools.find(t => t.tool.name === 'k8s_apply_manifest');
      const schema = applyManifestTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.manifest).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('manifest');
    });

    it('should have valid input schema for k8s_export_resource', () => {
      const tools = registerConfigTools(mockK8sClient);
      const exportResourceTool = tools.find(t => t.tool.name === 'k8s_export_resource');
      const schema = exportResourceTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.kind).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('kind');
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_edit', () => {
      const tools = registerConfigTools(mockK8sClient);
      const editTool = tools.find(t => t.tool.name === 'k8s_edit');
      const schema = editTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.resource).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.required).toContain('resource');
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_convert', () => {
      const tools = registerConfigTools(mockK8sClient);
      const convertTool = tools.find(t => t.tool.name === 'k8s_convert');
      const schema = convertTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.manifest).toBeDefined();
      expect(schema?.properties?.outputVersion).toBeDefined();
      expect(schema?.required).toContain('manifest');
      expect(schema?.required).toContain('outputVersion');
    });
  });
});
