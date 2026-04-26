/**
 * Validation utilities for K8s MCP Server
 * Provides input validation for Kubernetes resources and parameters
 */

import { K8sMcpError } from "./error-handling.js";

/**
 * Validate Kubernetes resource name according to DNS subdomain naming convention
 */
export function validateResourceName(name: string, resourceType: string = "resource"): void {
  if (!name || typeof name !== "string") {
    throw new K8sMcpError(
      "validation",
      `${resourceType} name must be a non-empty string`,
      { operation: "validateResourceName", resource: name }
    );
  }

  if (name.length > 253) {
    throw new K8sMcpError(
      "validation",
      `${resourceType} name cannot exceed 253 characters`,
      { operation: "validateResourceName", resource: name }
    );
  }

  if (name.length < 1) {
    throw new K8sMcpError(
      "validation",
      `${resourceType} name cannot be empty`,
      { operation: "validateResourceName", resource: name }
    );
  }

  // Kubernetes DNS subdomain naming convention
  const dnsSubdomainPattern = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
  if (!dnsSubdomainPattern.test(name)) {
    throw new K8sMcpError(
      "validation",
      `${resourceType} name "${name}" must consist of lowercase alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character`,
      { operation: "validateResourceName", resource: name },
      undefined,
      [
        "Use only lowercase letters, numbers, hyphens, and dots",
        "Name must start and end with alphanumeric character",
        "Example: my-app-1, web-service.v2"
      ]
    );
  }
}

/**
 * Validate Kubernetes namespace
 */
export function validateNamespace(namespace: string): void {
  if (!namespace || typeof namespace !== "string") {
    throw new K8sMcpError(
      "validation",
      "Namespace must be a non-empty string",
      { operation: "validateNamespace", namespace }
    );
  }

  validateResourceName(namespace, "namespace");
}

/**
 * Validate Kubernetes label selector
 */
export function validateLabelSelector(selector: string): void {
  if (!selector || typeof selector !== "string") {
    throw new K8sMcpError(
      "validation",
      "Label selector must be a non-empty string",
      { operation: "validateLabelSelector" }
    );
  }

  // Basic label selector format validation
  // Supports: key=value, key!=value, key, !key, key in (v1, v2), key notin (v1, v2)
  // const validSelectorPattern = /^[a-zA-Z0-9][-a-zA-Z0-9_.]*(([!=]=[^,]+)|(\s+(in|notin)\s*\([^)]+\)))?$/;
  
  // Split by comma for multiple selectors
  const selectors = selector.split(",").map(s => s.trim());
  
  for (const sel of selectors) {
    if (!sel) continue;
    
    // Simple validation - more complex selectors may need relaxed validation
    if (sel.includes("(") && !sel.includes(")")) {
      throw new K8sMcpError(
        "validation",
        `Invalid label selector: "${sel}" - unmatched parenthesis`,
        { operation: "validateLabelSelector" }
      );
    }
  }
}

/**
 * Validate port number
 */
export function validatePort(port: number): void {
  if (typeof port !== "number" || !Number.isInteger(port)) {
    throw new K8sMcpError(
      "validation",
      "Port must be an integer",
      { operation: "validatePort" }
    );
  }

  if (port < 1 || port > 65535) {
    throw new K8sMcpError(
      "validation",
      `Port ${port} is invalid. Must be between 1-65535`,
      { operation: "validatePort" }
    );
  }
}

/**
 * Validate replica count
 */
export function validateReplicas(replicas: number): void {
  if (typeof replicas !== "number" || !Number.isInteger(replicas)) {
    throw new K8sMcpError(
      "validation",
      "Replicas must be an integer",
      { operation: "validateReplicas" }
    );
  }

  if (replicas < 0) {
    throw new K8sMcpError(
      "validation",
      "Replicas cannot be negative",
      { operation: "validateReplicas" }
    );
  }

  if (replicas > 10000) {
    throw new K8sMcpError(
      "validation",
      "Replicas cannot exceed 10000",
      { operation: "validateReplicas" },
      undefined,
      ["Consider using a different scaling strategy for large workloads"]
    );
  }
}
