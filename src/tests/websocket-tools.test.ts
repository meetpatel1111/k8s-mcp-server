import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerWebSocketTools } from '../k8s-tools/websocket.js';
import { K8sClient } from '../k8s-client.js';

describe('WebSocket Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerWebSocketTools', () => {
    it('should register websocket tools', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_exec_pod tool', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const execPodTool = tools.find(t => t.tool.name === 'k8s_exec_pod');
      expect(execPodTool).toBeDefined();
      expect(execPodTool?.tool.description).toBe('Execute command in a pod, or first pod of a deployment/service. Supports format like \'deploy/my-deployment\' or \'svc/my-service\'. Can execute directly (returns output) or return WebSocket URL for interactive sessions.');
      expect(execPodTool?.tool.inputSchema).toBeDefined();
      expect(execPodTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_port_forward tool', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const portForwardTool = tools.find(t => t.tool.name === 'k8s_port_forward');
      expect(portForwardTool).toBeDefined();
      expect(portForwardTool?.tool.description).toBe('Set up port forwarding to a pod, deployment, or service. Supports format like \'deploy/my-deployment\' or \'svc/my-service\'. Use mode=\'direct\' for immediate port forwarding.');
      expect(portForwardTool?.tool.inputSchema).toBeDefined();
      expect(portForwardTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_stream_logs tool', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const streamLogsTool = tools.find(t => t.tool.name === 'k8s_stream_logs');
      expect(streamLogsTool).toBeDefined();
      expect(streamLogsTool?.tool.description).toBe('Stream pod logs in real-time (returns stream info)');
      expect(streamLogsTool?.tool.inputSchema).toBeDefined();
      expect(streamLogsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_attach_pod tool', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const attachPodTool = tools.find(t => t.tool.name === 'k8s_attach_pod');
      expect(attachPodTool).toBeDefined();
      expect(attachPodTool?.tool.description).toBe('Attach to running pod (returns attach info)');
      expect(attachPodTool?.tool.inputSchema).toBeDefined();
      expect(attachPodTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_watch tool', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const watchTool = tools.find(t => t.tool.name === 'k8s_watch');
      expect(watchTool).toBeDefined();
      expect(watchTool?.tool.description).toBe('Watch resources for changes in real-time (like kubectl get --watch). Returns WebSocket URL for streaming events.');
      expect(watchTool?.tool.inputSchema).toBeDefined();
      expect(watchTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_exec_pod', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const execPodTool = tools.find(t => t.tool.name === 'k8s_exec_pod');
      const schema = execPodTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.resource).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.container).toBeDefined();
      expect(schema?.properties?.command).toBeDefined();
      expect(schema?.properties?.tty).toBeDefined();
      expect(schema?.properties?.stdin).toBeDefined();
      expect(schema?.properties?.mode).toBeDefined();
      expect(schema?.required).toContain('resource');
      expect(schema?.required).toContain('namespace');
    });

    it('should have valid input schema for k8s_port_forward', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const portForwardTool = tools.find(t => t.tool.name === 'k8s_port_forward');
      const schema = portForwardTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.resource).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.ports).toBeDefined();
      expect(schema?.properties?.mode).toBeDefined();
      expect(schema?.required).toContain('resource');
      expect(schema?.required).toContain('ports');
    });

    it('should have valid input schema for k8s_stream_logs', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const streamLogsTool = tools.find(t => t.tool.name === 'k8s_stream_logs');
      const schema = streamLogsTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.pod).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.container).toBeDefined();
      expect(schema?.properties?.follow).toBeDefined();
      expect(schema?.properties?.tailLines).toBeDefined();
      expect(schema?.required).toContain('pod');
      expect(schema?.required).toContain('namespace');
    });

    it('should have valid input schema for k8s_attach_pod', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const attachPodTool = tools.find(t => t.tool.name === 'k8s_attach_pod');
      const schema = attachPodTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.pod).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.container).toBeDefined();
      expect(schema?.properties?.stdin).toBeDefined();
      expect(schema?.properties?.stdout).toBeDefined();
      expect(schema?.properties?.stderr).toBeDefined();
      expect(schema?.required).toContain('pod');
      expect(schema?.required).toContain('namespace');
    });

    it('should have valid input schema for k8s_watch', () => {
      const tools = registerWebSocketTools(mockK8sClient);
      const watchTool = tools.find(t => t.tool.name === 'k8s_watch');
      const schema = watchTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.resource).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.labelSelector).toBeDefined();
      expect(schema?.properties?.fieldSelector).toBeDefined();
      expect(schema?.required).toContain('resource');
    });
  });
});
