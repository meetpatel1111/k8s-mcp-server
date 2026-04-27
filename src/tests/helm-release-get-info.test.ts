import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerHelmReleaseGetInfoTools } from '../helm-tools/release-get-info.js';
import { K8sClient } from '../k8s-client.js';

describe('Helm Release Get Info Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerHelmReleaseGetInfoTools', () => {
    it('should register release get info tools', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_helm_get_manifest tool', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const manifestTool = tools.find(t => t.tool.name === 'k8s_helm_get_manifest');
      expect(manifestTool).toBeDefined();
      expect(manifestTool?.tool.description).toBe('Get the manifest of a named release (generated Kubernetes resources)');
      expect(manifestTool?.tool.inputSchema).toBeDefined();
      expect(manifestTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_get_notes tool', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const notesTool = tools.find(t => t.tool.name === 'k8s_helm_get_notes');
      expect(notesTool).toBeDefined();
      expect(notesTool?.tool.description).toBe('Get the notes of a named release');
      expect(notesTool?.tool.inputSchema).toBeDefined();
      expect(notesTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_get_hooks tool', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const hooksTool = tools.find(t => t.tool.name === 'k8s_helm_get_hooks');
      expect(hooksTool).toBeDefined();
      expect(hooksTool?.tool.description).toBe('Get the hooks of a named release');
      expect(hooksTool?.tool.inputSchema).toBeDefined();
      expect(hooksTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_get_all tool', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const getAllTool = tools.find(t => t.tool.name === 'k8s_helm_get_all');
      expect(getAllTool).toBeDefined();
      expect(getAllTool?.tool.description).toBe('Get all information about a release (values, manifest, hooks, notes)');
      expect(getAllTool?.tool.inputSchema).toBeDefined();
      expect(getAllTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_helm_get_metadata tool', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const metadataTool = tools.find(t => t.tool.name === 'k8s_helm_get_metadata');
      expect(metadataTool).toBeDefined();
      expect(metadataTool?.tool.description).toBe('Fetch metadata for a Helm release');
      expect(metadataTool?.tool.inputSchema).toBeDefined();
      expect(metadataTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_helm_get_manifest', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const manifestTool = tools.find(t => t.tool.name === 'k8s_helm_get_manifest');
      const schema = manifestTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });

    it('should have valid input schema for k8s_helm_get_notes', () => {
      const tools = registerHelmReleaseGetInfoTools(mockK8sClient);
      const notesTool = tools.find(t => t.tool.name === 'k8s_helm_get_notes');
      const schema = notesTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.release).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('release');
    });
  });
});
