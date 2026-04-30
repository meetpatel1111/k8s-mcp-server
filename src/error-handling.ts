import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import {
  validateResourceName,
  validateNamespace,
  validateLabelSelector,
  validatePort,
  validateReplicas,
} from "./validators.js";

// Re-export validation functions for backward compatibility
export {
  validateResourceName,
  validateNamespace,
  validateLabelSelector,
  validatePort,
  validateReplicas,
};

/**
 * Comprehensive error handling and edge case management for Kubernetes MCP Server
 */

// Error classification types
export type ErrorType = 
  | "network" 
  | "timeout" 
  | "permission" 
  | "not_found" 
  | "validation" 
  | "conflict" 
  | "server" 
  | "client" 
  | "unknown";

// Error context for detailed reporting
export interface ErrorContext {
  operation: string;
  resource?: string;
  namespace?: string;
  details?: Record<string, any>;
}

// Enhanced error with classification
export class K8sMcpError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly suggestions: string[];
  public readonly details?: Record<string, any>;

  constructor(
    type: ErrorType,
    message: string,
    context: ErrorContext,
    originalError?: Error,
    suggestions: string[] = [],
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "K8sMcpError";
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.suggestions = suggestions;
    this.details = details;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      operation: this.context.operation,
      resource: this.context.resource,
      namespace: this.context.namespace,
      suggestions: this.suggestions,
      details: this.details,
    };
  }
}

// Error classifier
export function classifyError(error: any, context: ErrorContext): K8sMcpError {
  const errorMessage = String(error?.message || error || "Unknown error");
  const errorBody = error?.body || error?.response?.body;

  // Network errors
  if (errorMessage.includes("ECONNREFUSED") || 
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("socket hang up") ||
      errorMessage.includes("network")) {
    return new K8sMcpError(
      "network",
      `Network error: Unable to connect to Kubernetes cluster. ${errorMessage}`,
      context,
      error,
      [
        "Verify cluster is running and accessible",
        "Check kubeconfig is correctly configured",
        "Ensure network connectivity to cluster",
        "For cloud clusters, verify VPN/connection is active"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Timeout errors
  if (errorMessage.includes("timeout") || 
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("deadline exceeded")) {
    return new K8sMcpError(
      "timeout",
      `Operation timeout: ${context.operation} took too long to complete.`,
      context,
      error,
      [
        "The operation may be too complex or cluster is under load",
        "Try with a longer timeout if applicable",
        "Check if cluster API server is responsive",
        "For large operations, consider breaking them into smaller chunks"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode }
    );
  }

  // Permission/Auth errors
  if (errorMessage.includes("Unauthorized") || 
      errorMessage.includes("Forbidden") ||
      errorMessage.includes("permission") ||
      errorMessage.includes("RBAC") ||
      error?.statusCode === 401 ||
      error?.statusCode === 403) {
    return new K8sMcpError(
      "permission",
      `Permission denied: You don't have permission to ${context.operation}.`,
      context,
      error,
      [
        "Verify your kubeconfig has correct credentials",
        "Check RBAC permissions for this operation",
        "Ensure ServiceAccount has required roles/bindings",
        "Contact cluster administrator for access"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Not found errors
  if (errorMessage.includes("not found") || 
      errorMessage.includes("doesn't exist") ||
      errorMessage.includes("does not exist") ||
      error?.statusCode === 404) {
    return new K8sMcpError(
      "not_found",
      `Resource not found: ${context.resource || "Resource"} not found${context.namespace ? ` in namespace ${context.namespace}` : ""}.`,
      context,
      error,
      [
        `Verify the resource name is correct`,
        `Check that you're using the right namespace`,
        `List resources to see available options`,
        `Resource may have been deleted or never created`
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Validation errors
  if (errorMessage.includes("validation") || 
      errorMessage.includes("invalid") ||
      errorMessage.includes("required") ||
      error?.statusCode === 422) {
    return new K8sMcpError(
      "validation",
      `Validation error: ${errorMessage}`,
      context,
      error,
      [
        "Check all required fields are provided",
        "Verify field values match expected format",
        "Review resource schema for correct structure",
        "Ensure referenced resources exist"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Conflict errors
  if (errorMessage.includes("conflict") || 
      errorMessage.includes("already exists") ||
      errorMessage.includes("Concurrent") ||
      error?.statusCode === 409) {
    return new K8sMcpError(
      "conflict",
      `Conflict: ${errorMessage}`,
      context,
      error,
      [
        "Resource may already exist with this name",
        "Another operation may be in progress",
        "Wait a moment and retry the operation",
        "Check for resource version conflicts"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Server errors (5xx)
  if (error?.statusCode >= 500 || 
      errorMessage.includes("internal server error") ||
      errorMessage.includes("ServiceUnavailable")) {
    return new K8sMcpError(
      "server",
      `Server error: Kubernetes API server error. ${errorMessage}`,
      context,
      error,
      [
        "Cluster API server may be under high load",
        "Retry the operation after a brief wait",
        "Check cluster health and component status",
        "Contact cluster administrator if issue persists"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Client errors (other 4xx)
  if (error?.statusCode >= 400) {
    return new K8sMcpError(
      "client",
      `Client error: ${errorMessage}`,
      context,
      error,
      [
        "Check request parameters and format",
        "Verify API version is correct",
        "Ensure all required fields are provided"
      ],
      { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
    );
  }

  // Unknown errors
  return new K8sMcpError(
    "unknown",
    `Unexpected error during ${context.operation}: ${errorMessage}`,
    context,
    error,
    [
      "This is an unexpected error",
      "Check the full error details",
      "Try the operation again",
      "Report the issue if it persists"
    ],
    { originalMessage: errorMessage, statusCode: error?.statusCode, body: errorBody }
  );
}


// YAML validation
export function validateYamlManifest(manifest: string): { valid: boolean; error?: string; documents?: any[] } {
  if (!manifest || typeof manifest !== "string") {
    return { valid: false, error: "Manifest must be a non-empty string" };
  }

  // Enforce maximum manifest payload size (1MB limit to prevent memory exhaustion)
  const MAX_MANIFEST_SIZE = 1024 * 1024;
  if (manifest.length > MAX_MANIFEST_SIZE) {
    return { valid: false, error: `Manifest exceeds maximum allowed size of 1MB (current: ${(manifest.length / 1024).toFixed(2)}KB)` };
  }

  try {
    const documents = yaml.loadAll(manifest) as any[];
    
    if (!documents || documents.length === 0) {
      return { valid: false, error: "No valid YAML documents found" };
    }

    // Enforce maximum number of documents per apply
    const MAX_DOCUMENTS = 50;
    if (documents.length > MAX_DOCUMENTS) {
      return { valid: false, error: `Manifest contains too many documents (${documents.length}). Maximum allowed is ${MAX_DOCUMENTS}.` };
    }

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      if (!doc) {
        return { valid: false, error: `Document ${i + 1} is empty or invalid` };
      }

      if (!doc.apiVersion) {
        return { valid: false, error: `Document ${i + 1} missing required field: apiVersion` };
      }

      if (!doc.kind) {
        return { valid: false, error: `Document ${i + 1} missing required field: kind` };
      }

      if (!doc.metadata) {
        return { valid: false, error: `Document ${i + 1} missing required field: metadata` };
      }

      if (!doc.metadata.name) {
        return { valid: false, error: `Document ${i + 1} missing required field: metadata.name` };
      }

      // Validate resource name
      try {
        validateResourceName(doc.metadata.name, doc.kind);
      } catch (err: any) {
        return { valid: false, error: `Document ${i + 1} invalid resource name: ${err.message}` };
      }

      // Validate replicas if present
      if (doc.spec && typeof doc.spec.replicas !== "undefined") {
        try {
          validateReplicas(doc.spec.replicas);
        } catch (err: any) {
          return { valid: false, error: `Document ${i + 1} invalid replicas: ${err.message}` };
        }
      }
    }

    return { valid: true, documents };
  } catch (error: any) {
    return { valid: false, error: `YAML parsing error: ${error.message}` };
  }
}

// Safe execution wrapper
export async function safeExecute<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: {
    retry?: boolean;
    maxRetries?: number;
    timeout?: number;
  } = {}
): Promise<T> {
  const { retry = true, maxRetries = 3, timeout = 30000 } = options;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= (retry ? maxRetries : 1); attempt++) {
    try {
      // Execute with timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry validation errors
      const classified = classifyError(error, context);
      if (classified.type === "validation" || classified.type === "permission") {
        throw classified;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw classified;
      }
      
      // Exponential backoff before retry
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw classifyError(lastError, context);
}

// Resource existence checker
export async function checkResourceExists(
  k8sClient: any,
  resourceType: string,
  name: string,
  namespace?: string
): Promise<{ exists: boolean; details?: any }> {
  try {
    let response: any;
    
    switch (resourceType.toLowerCase()) {
      case "pod":
      case "pods":
        response = await k8sClient.getCoreV1Api().readNamespacedPod(name, namespace || "default");
        break;
      case "deployment":
      case "deployments":
        response = await k8sClient.getAppsV1Api().readNamespacedDeployment(name, namespace || "default");
        break;
      case "service":
      case "services":
      case "svc":
        response = await k8sClient.getCoreV1Api().readNamespacedService(name, namespace || "default");
        break;
      case "configmap":
      case "configmaps":
      case "cm":
        response = await k8sClient.getCoreV1Api().readNamespacedConfigMap(name, namespace || "default");
        break;
      case "secret":
      case "secrets":
        response = await k8sClient.getCoreV1Api().readNamespacedSecret(name, namespace || "default");
        break;
      case "node":
      case "nodes":
        response = await k8sClient.getCoreV1Api().readNode(name);
        break;
      default:
        return { exists: false };
    }
    
    return { exists: true, details: response?.body };
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message?.includes("not found")) {
      return { exists: false };
    }
    throw error;
  }
}

// Graceful degradation helper
export function createGracefulDegradation<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  return safeExecute(primary, context, { retry: false })
    .catch(async (primaryError) => {
      console.error(`Primary operation failed, attempting fallback: ${primaryError.message}`);
      return safeExecute(fallback, { ...context, operation: `${context.operation} (fallback)` }, { retry: false });
    });
}

// Batch operation handler with partial success
export async function executeBatch<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  context: ErrorContext,
  options: {
    continueOnError?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<{
  successful: { item: T; result: R }[];
  failed: { item: T; error: K8sMcpError }[];
  summary: string;
}> {
  const { continueOnError = true, maxConcurrency = 5 } = options;
  
  const successful: { item: T; result: R }[] = [];
  const failed: { item: T; error: K8sMcpError }[] = [];
  
  // Process in chunks for concurrency control
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const chunk = items.slice(i, i + maxConcurrency);
    
    const results = await Promise.allSettled(
      chunk.map(async (item) => {
        try {
          const result = await operation(item);
          return { success: true, item, result };
        } catch (error) {
          const classified = classifyError(error, { ...context, resource: String(item) });
          return { success: false, item, error: classified };
        }
      })
    );
    
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        if (result.value.success) {
          successful.push({ item: result.value.item, result: result.value.result as R });
        } else {
          failed.push({ item: result.value.item, error: result.value.error as K8sMcpError });
          if (!continueOnError) {
            break;
          }
        }
      } else if (result.status === "fulfilled") {
        // Handle undefined case
        failed.push({ 
          item: chunk[0], 
          error: new K8sMcpError("unknown", "Operation returned undefined", context)
        });
        if (!continueOnError) {
          break;
        }
      } else {
        // Rejected promise
        failed.push({ 
          item: chunk[0], 
          error: classifyError(result.reason, context) 
        });
        if (!continueOnError) {
          break;
        }
      }
    }
    
    if (!continueOnError && failed.length > 0) {
      break;
    }
  }
  
  return {
    successful,
    failed,
    summary: `${successful.length}/${items.length} succeeded, ${failed.length} failed`
  };
}
