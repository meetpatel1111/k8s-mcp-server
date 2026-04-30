# Metrics Server Installation Guide

The k8s-helm-mcp includes several tools that require metrics-server to be installed on your Kubernetes cluster:

- `k8s_top_node` - Display resource usage (CPU/Memory) for nodes
- `k8s_top_pod` - Display resource usage (CPU/Memory) for pods
- `k8s_get_node_metrics` - Get node metrics
- `k8s_get_pod_metrics` - Get pod metrics

Without metrics-server, these tools will return "N/A" or errors.

## What is Metrics Server?

Metrics Server is a scalable, efficient source of container resource metrics for Kubernetes built-in autoscaling pipelines. It collects resource metrics from Kubelets and exposes them in Kubernetes APIs through the Metrics API.

## Installation

### Option 1: Using YAML Manifest (Recommended)

**For Kubernetes 1.19+**:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**For specific versions**, check the [Metrics Server releases](https://github.com/kubernetes-sigs/metrics-server/releases) page.

### Option 2: Using Helm

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm upgrade --install metrics-server metrics-server/metrics-server --namespace kube-system
```

### Option 3: Using kubectl apply (from local file)

1. Download the latest components.yaml:
```bash
curl -L https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml -o metrics-server.yaml
```

2. Apply the manifest:
```bash
kubectl apply -f metrics-server.yaml
```

## Verification

After installation, verify metrics-server is running:

```bash
# Check metrics-server pod
kubectl get pods -n kube-system -l k8s-app=metrics-server

# Should show something like:
# NAME                              READY   STATUS    RESTARTS   AGE
# metrics-server-xxx                 1/1     Running   0          2m
```

Test the metrics API:

```bash
# Test node metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes

# Test pod metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/<namespace>/pods/<pod-name>
```

## Troubleshooting

### Metrics Server Pod Not Starting

Check pod logs:
```bash
kubectl logs -n kube-system -l k8s-app=metrics-server
```

**Common Issue**: `unable to fully scrape metrics from source`

**Solution**: Add the `--kubelet-insecure-tls` flag to the metrics-server deployment. Edit the deployment:

```bash
kubectl edit deployment metrics-server -n kube-system
```

Add to the container args:
```yaml
args:
  - --cert-dir=/tmp
  - --secure-port=4443
  - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
  - --kubelet-use-node-status-port
  - --kubelet-insecure-tls
```

### Metrics Not Available

If metrics are not available after installation:

1. Wait 1-2 minutes for metrics to be collected
2. Check if metrics-server API is accessible:
```bash
kubectl get --raw /apis/metrics.k8s.io/v1beta1
```

3. Check kubelet metrics endpoint:
```bash
kubectl get --raw /api/v1/nodes/<node-name>/proxy/metrics
```

### Permission Issues

Ensure metrics-server has the necessary RBAC permissions. The default installation includes the required ClusterRole and ClusterRoleBinding.

## Cloud Provider Specific Notes

### AWS EKS

Metrics Server should work out of the box on EKS. No special configuration required.

### Azure AKS

Metrics Server is often pre-installed on AKS clusters. Check if it's already running:

```bash
kubectl get pods -n kube-system | grep metrics
```

If not present, install using the standard YAML manifest.

### GCP GKE

Metrics Server is typically pre-installed on GKE. Verify with:
```bash
kubectl get services -n kube-system | grep metrics-server
```

## Using Metrics with MCP Server

Once metrics-server is installed and running, you can use the following MCP tools:

### Example: Get Node Metrics

```
Use k8s_top_node to see resource usage across all nodes
```

### Example: Get Pod Metrics

```
Use k8s_top_pod to see resource usage for all pods in a namespace
```

### Example: Get Specific Pod Metrics

```
Use k8s_get_pod_metrics with pod name and namespace
```

## Uninstalling Metrics Server

If you need to remove metrics-server:

```bash
kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Or if installed via Helm:
```bash
helm uninstall metrics-server -n kube-system
```

## Additional Resources

- [Metrics Server GitHub Repository](https://github.com/kubernetes-sigs/metrics-server)
- [Kubernetes Metrics API Documentation](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-usage-monitoring/)
- [Metrics Server Troubleshooting Guide](https://github.com/kubernetes-sigs/metrics-server/blob/master/docs/troubleshooting.md)
