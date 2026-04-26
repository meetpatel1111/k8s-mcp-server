/**
 * Tool Registry helper for K8s MCP Server
 * Provides consistent tool registration pattern
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolRegistration {
  tool: Tool;
  handler: Function;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private handlers: Map<string, Function> = new Map();

  /**
   * Register a single tool
   */
  register(registration: ToolRegistration): void {
    const { tool, handler } = registration;
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  /**
   * Register multiple tools at once
   */
  registerMany(registrations: ToolRegistration[]): void {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get a handler by name
   */
  getHandler(name: string): Function | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Map<string, Tool> {
    return new Map(this.tools);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): Map<string, Function> {
    return new Map(this.handlers);
  }

  /**
   * Get the count of registered tools
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.handlers.clear();
  }
}
