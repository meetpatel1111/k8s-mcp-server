# API Documentation

This document provides detailed API documentation for key k8s-mcp-server tools, including input/output schemas, parameters, and examples.

## Table of Contents

- [Pod Operations](#pod-operations)
- [Workload Operations](#workload-operations)
- [Service Operations](#service-operations)
- [Node Operations](#node-operations)
- [Configuration Operations](#configuration-operations)
- [Monitoring Operations](#monitoring-operations)

---

## Pod Operations

### k8s_list_pods

List pods in a namespace or across all namespaces.

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to filter pods
  labelSelector?: string;  // Optional: Label selector (e.g., "app=nginx")
  fieldSelector?: string;  // Optional: Field selector (e.g., "status.phase=Running")
}
```

**Output Schema:**
```typescript
{
  pods: Array<{
    name: string;
    namespace: string;
    status: string;
    age: string;
    ready: string;
    restarts: number;
  }>;
  total: number;
}
```

**Example:**
```javascript
// List all pods in default namespace
k8s_list_pods({ namespace: "default" })

// List pods with label selector
k8s_list_pods({ namespace: "production", labelSelector: "app=web" })
```

---

### k8s_get_pod

Get detailed information about a specific pod.

**Input Schema:**
```typescript
{
  name: string;  // Required: Pod name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  name: string;
  namespace: string;
  status: string;
  phase: string;
  podIP: string;
  hostIP: string;
  startTime: string;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }>;
  conditions: Array<{
    type: string;
    status: string;
    lastTransitionTime: string;
  }>;
}
```

**Example:**
```javascript
k8s_get_pod({ name: "my-app-123", namespace: "default" })
```

---

### k8s_get_pod_logs

Get logs from a pod.

**Input Schema:**
```typescript
{
  name: string;  // Required: Pod name
  namespace: string;  // Required: Namespace
  container?: string;  // Optional: Container name (for multi-container pods)
  tailLines?: number;  // Optional: Number of lines from end (default: 100)
  follow?: boolean;  // Optional: Stream logs in real-time (default: false)
  previous?: boolean;  // Optional: Get logs from previous container instance (default: false)
  timestamps?: boolean;  // Optional: Include timestamps (default: false)
}
```

**Output Schema:**
```typescript
{
  logs: string;
  pod: string;
  namespace: string;
  container?: string;
  lines: number;
}
```

**Example:**
```javascript
// Get last 50 lines of logs
k8s_get_pod_logs({ 
  name: "my-app", 
  namespace: "default", 
  tailLines: 50 
})

// Follow logs in real-time
k8s_get_pod_logs({ 
  name: "my-app", 
  namespace: "default", 
  follow: true 
})
```

---

### k8s_delete_pod

Delete a pod.

**Input Schema:**
```typescript
{
  name: string;  // Required: Pod name
  namespace: string;  // Required: Namespace
  gracePeriodSeconds?: number;  // Optional: Grace period in seconds (default: 30)
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  pod: string;
  namespace: string;
}
```

**Example:**
```javascript
k8s_delete_pod({ 
  name: "my-app-123", 
  namespace: "default",
  gracePeriodSeconds: 0  // Immediate deletion
})
```

---

### k8s_restart_pod

Restart a pod by deleting it (will be recreated if part of a controller).

**Input Schema:**
```typescript
{
  name: string;  // Required: Pod name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  pod: string;
  namespace: string;
}
```

**Example:**
```javascript
k8s_restart_pod({ name: "my-app-123", namespace: "default" })
```

---

## Workload Operations

### k8s_list_deployments

List deployments in a namespace or across all namespaces.

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to filter deployments
  labelSelector?: string;  // Optional: Label selector
}
```

**Output Schema:**
```typescript
{
  deployments: Array<{
    name: string;
    namespace: string;
    ready: string;
    upToDate: string;
    available: string;
    age: string;
  }>;
  total: number;
}
```

**Example:**
```javascript
k8s_list_deployments({ namespace: "production" })
```

---

### k8s_get_deployment

Get detailed information about a deployment.

**Input Schema:**
```typescript
{
  name: string;  // Required: Deployment name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  name: string;
  namespace: string;
  replicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  age: string;
  conditions: Array<{
    type: string;
    status: string;
    reason: string;
    message: string;
  }>;
  strategy: {
    type: string;
    rollingUpdate?: {
      maxUnavailable: string;
      maxSurge: string;
    };
  };
}
```

**Example:**
```javascript
k8s_get_deployment({ name: "web-app", namespace: "default" })
```

---

### k8s_scale_deployment

Scale a deployment to a specific number of replicas.

**Input Schema:**
```typescript
{
  name: string;  // Required: Deployment name
  namespace: string;  // Required: Namespace
  replicas: number;  // Required: Number of replicas
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  deployment: string;
  namespace: string;
  replicas: number;
}
```

**Example:**
```javascript
k8s_scale_deployment({ 
  name: "web-app", 
  namespace: "default", 
  replicas: 5 
})
```

---

### k8s_restart_deployment

Perform a rolling restart of a deployment.

**Input Schema:**
```typescript
{
  name: string;  // Required: Deployment name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  deployment: string;
  namespace: string;
}
```

**Example:**
```javascript
k8s_restart_deployment({ name: "web-app", namespace: "default" })
```

---

### k8s_rollback_deployment

Rollback a deployment to a previous revision.

**Input Schema:**
```typescript
{
  name: string;  // Required: Deployment name
  namespace: string;  // Required: Namespace
  revision?: number;  // Optional: Specific revision to rollback to (default: previous)
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  deployment: string;
  namespace: string;
  revision: number;
}
```

**Example:**
```javascript
// Rollback to previous revision
k8s_rollback_deployment({ name: "web-app", namespace: "default" })

// Rollback to specific revision
k8s_rollback_deployment({ 
  name: "web-app", 
  namespace: "default", 
  revision: 3 
})
```

---

## Service Operations

### k8s_list_services

List services in a namespace or across all namespaces.

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to filter services
  labelSelector?: string;  // Optional: Label selector
}
```

**Output Schema:**
```typescript
{
  services: Array<{
    name: string;
    namespace: string;
    type: string;
    clusterIP: string;
    externalIPs: string[];
    ports: Array<{
      name: string;
      port: number;
      protocol: string;
      targetPort: number;
    }>;
    age: string;
  }>;
  total: number;
}
```

**Example:**
```javascript
k8s_list_services({ namespace: "default" })
```

---

### k8s_get_service

Get detailed information about a service.

**Input Schema:**
```typescript
{
  name: string;  // Required: Service name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  ports: Array<{
    name: string;
    port: number;
    protocol: string;
    targetPort: number;
    nodePort?: number;
  }>;
  selector: Record<string, string>;
  sessionAffinity: string;
  age: string;
}
```

**Example:**
```javascript
k8s_get_service({ name: "web-service", namespace: "default" })
```

---

### k8s_get_service_endpoints

Get endpoints for a service.

**Input Schema:**
```typescript
{
  name: string;  // Required: Service name
  namespace: string;  // Required: Namespace
}
```

**Output Schema:**
```typescript
{
  name: string;
  namespace: string;
  endpoints: Array<{
    addresses: string[];
    ports: Array<{
      name: string;
      port: number;
      protocol: string;
    }>;
  }>;
  ready: boolean;
}
```

**Example:**
```javascript
k8s_get_service_endpoints({ name: "web-service", namespace: "default" })
```

---

## Node Operations

### k8s_list_nodes

List all nodes in the cluster.

**Input Schema:**
```typescript
{
  // No required parameters
}
```

**Output Schema:**
```typescript
{
  nodes: Array<{
    name: string;
    status: string;
    roles: string;
    version: string;
    internalIP: string;
    externalIP: string;
    osImage: string;
    kernelVersion: string;
    containerRuntime: string;
    age: string;
  }>;
  total: number;
}
```

**Example:**
```javascript
k8s_list_nodes()
```

---

### k8s_get_node

Get detailed information about a node.

**Input Schema:**
```typescript
{
  name: string;  // Required: Node name
}
```

**Output Schema:**
```typescript
{
  name: string;
  status: string;
  roles: string;
  version: string;
  internalIP: string;
  externalIP: string;
  osImage: string;
  kernelVersion: string;
  containerRuntime: string;
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: string;
  };
  conditions: Array<{
    type: string;
    status: string;
    reason: string;
    message: string;
  }>;
  age: string;
}
```

**Example:**
```javascript
k8s_get_node({ name: "node-1" })
```

---

### k8s_cordon_node

Mark a node as unschedulable (cordon).

**Input Schema:**
```typescript
{
  name: string;  // Required: Node name
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  node: string;
  unschedulable: boolean;
}
```

**Example:**
```javascript
k8s_cordon_node({ name: "node-1" })
```

---

### k8s_uncordon_node

Mark a node as schedulable (uncordon).

**Input Schema:**
```typescript
{
  name: string;  // Required: Node name
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  node: string;
  unschedulable: boolean;
}
```

**Example:**
```javascript
k8s_uncordon_node({ name: "node-1" })
```

---

## Configuration Operations

### k8s_apply_manifest

Apply a Kubernetes manifest (YAML or JSON).

**Input Schema:**
```typescript
{
  manifest: string;  // Required: YAML or JSON manifest content
  namespace?: string;  // Optional: Default namespace for resources
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  resources: Array<{
    kind: string;
    name: string;
    namespace?: string;
    action: string;
  }>;
}
```

**Example:**
```javascript
k8s_apply_manifest({
  manifest: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
  `,
  namespace: "default"
})
```

---

### k8s_validate_manifest

Validate a Kubernetes manifest without applying it.

**Input Schema:**
```typescript
{
  manifest: string;  // Required: YAML or JSON manifest content
}
```

**Output Schema:**
```typescript
{
  valid: boolean;
  errors?: Array<{
    line: number;
    column: number;
    message: string;
  }>;
  warnings?: Array<string>;
  resources?: Array<{
    kind: string;
    name: string;
  }>;
}
```

**Example:**
```javascript
k8s_validate_manifest({
  manifest: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
  `
})
```

---

### k8s_create_namespace

Create a new namespace.

**Input Schema:**
```typescript
{
  name: string;  // Required: Namespace name
  labels?: Record<string, string>;  // Optional: Labels to apply
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  namespace: string;
  labels?: Record<string, string>;
}
```

**Example:**
```javascript
k8s_create_namespace({
  name: "production",
  labels: { environment: "prod", team: "platform" }
})
```

---

### k8s_delete_namespace

Delete a namespace.

**Input Schema:**
```typescript
{
  name: string;  // Required: Namespace name
  force?: boolean;  // Optional: Force delete (remove finalizers)
}
```

**Output Schema:**
```typescript
{
  success: boolean;
  message: string;
  namespace: string;
}
```

**Example:**
```javascript
k8s_delete_namespace({ name: "staging" })
```

---

## Monitoring Operations

### k8s_health_score

Calculate cluster health score based on various factors.

**Input Schema:**
```typescript
{
  // No required parameters
}
```

**Output Schema:**
```typescript
{
  score: number;  // 0-100 health score
  status: string;  // "healthy", "warning", "critical"
  factors: {
    nodes: {
      total: number;
      ready: number;
      notReady: number;
      score: number;
    };
    pods: {
      total: number;
      running: number;
      notReady: number;
      failed: number;
      score: number;
    };
    deployments: {
      total: number;
      available: number;
      unavailable: number;
      score: number;
    };
  };
  recommendations: string[];
}
```

**Example:**
```javascript
k8s_health_score()
```

---

### k8s_top_pod

Display resource usage for pods (requires metrics-server).

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to filter pods
  name?: string;  // Optional: Specific pod name
  allNamespaces?: boolean;  // Optional: Show pods across all namespaces
  containers?: boolean;  // Optional: Show per-container metrics
  sortBy?: "cpu" | "memory";  // Optional: Sort by CPU or memory
}
```

**Output Schema:**
```typescript
{
  pods: Array<{
    name: string;
    namespace: string;
    cpu: string;  // CPU usage in nanocores
    memory: string;  // Memory usage in bytes
    cpuPercent?: number;
    memoryPercent?: number;
    containers?: Array<{
      name: string;
      cpu: string;
      memory: string;
    }>;
  }>;
  total: number;
  sortBy?: string;
  note: string;
}
```

**Example:**
```javascript
// Show pods sorted by CPU usage
k8s_top_pod({ namespace: "default", sortBy: "cpu" })

// Show pods across all namespaces
k8s_top_pod({ allNamespaces: true })
```

---

### k8s_top_node

Display resource usage for nodes (requires metrics-server).

**Input Schema:**
```typescript
{
  name?: string;  // Optional: Specific node name
}
```

**Output Schema:**
```typescript
{
  nodes: Array<{
    name: string;
    cpu: string;  // CPU usage in cores
    memory: string;  // Memory usage in bytes
    cpuPercent: number;
    memoryPercent: number;
    timestamp: string;
    window: string;
  }>;
  total: number;
  note: string;
}
```

**Example:**
```javascript
k8s_top_node()
```

---

### k8s_find_crashloop_pods

Find pods in CrashLoopBackOff state.

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to search
}
```

**Output Schema:**
```typescript
{
  totalPods: number;
  crashLoopCount: number;
  pods: Array<{
    name: string;
    namespace: string;
    container: string;
    restartCount: number;
    lastState: string;
    reason: string;
    message: string;
  }>;
}
```

**Example:**
```javascript
k8s_find_crashloop_pods({ namespace: "production" })
```

---

### k8s_list_events

List cluster events.

**Input Schema:**
```typescript
{
  namespace?: string;  // Optional: Namespace to filter events
  type?: "Normal" | "Warning";  // Optional: Event type filter
  fieldSelector?: string;  // Optional: Field selector
}
```

**Output Schema:**
```typescript
{
  events: Array<{
    type: string;
    reason: string;
    message: string;
    involvedObject: {
      kind: string;
      name: string;
      namespace?: string;
    };
    firstTimestamp: string;
    lastTimestamp: string;
    count: number;
  }>;
  total: number;
}
```

**Example:**
```javascript
// List warning events
k8s_list_events({ namespace: "default", type: "Warning" })

// List events for a specific resource
k8s_list_events({ 
  fieldSelector: "involvedObject.name=my-pod" 
})
```

---

## Error Response Schema

All tools return a consistent error response when operations fail:

```typescript
{
  success: false;
  error: string;  // Human-readable error message
  type: string;  // Error type (e.g., "not_found", "permission_denied", "validation_error")
  suggestions: string[];  // Array of suggestions for resolving the error
}
```

**Example Error Response:**
```json
{
  "success": false,
  "error": "Pod 'my-pod' not found in namespace 'default'",
  "type": "not_found",
  "suggestions": [
    "Check the pod name for typos",
    "Verify the namespace is correct",
    "List all pods to see available names: k8s_list_pods"
  ]
}
```

---

## Common Patterns

### Pagination

For operations that return large lists, use label selectors or field selectors to filter results:

```javascript
// Filter by label
k8s_list_pods({ labelSelector: "app=nginx" })

// Filter by status
k8s_list_pods({ fieldSelector: "status.phase=Running" })
```

### Namespace Handling

Most tools accept an optional `namespace` parameter. If not provided:
- For namespaced resources: defaults to "default" or queries all namespaces
- For cluster-scoped resources: namespace is ignored

```javascript
// Specific namespace
k8s_list_pods({ namespace: "production" })

// All namespaces
k8s_list_pods({})  // or omit namespace parameter
```

### Infrastructure Protection

Destructive operations (delete, scale, etc.) may be blocked by infrastructure protection mode. To disable:

```javascript
// Via environment variable
INFRA_PROTECTION_MODE=false

// Via tool
k8s_toggle_protection_mode({ enabled: false, confirm: true })
```

---

## Rate Limiting & Timeouts

- **Default timeout**: 30 seconds per operation
- **Retry attempts**: 3 automatic retries with exponential backoff
- **Rate limiting**: Handled by Kubernetes API server

For long-running operations, consider using background tools or streaming options (e.g., `follow: true` for logs).
