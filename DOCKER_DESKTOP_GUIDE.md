# Docker Desktop Kubernetes - MCP Server Guide

## Prerequisites

1. **Docker Desktop** installed with Kubernetes enabled
   - Settings → Kubernetes → Enable Kubernetes ✅
   - Wait for "Kubernetes is running" status

2. **kubectl** (usually included with Docker Desktop)
   ```bash
   kubectl version --client
   kubectl config current-context  # Should show "docker-desktop"
   ```

## Configuration

Docker Desktop automatically:
- Creates context: `docker-desktop`
- Updates: `~/.kube/config`
- Sets as current context

## Testing the MCP Server

### 1. List Contexts
```
Use k8s_list_contexts
```
Expected: Shows `docker-desktop` as current context

### 2. Check Cluster Version
```
Use k8s_cluster_version
```
Expected: Shows Docker Desktop's K8s version (e.g., v1.28.x)

### 3. List Nodes
```
Use k8s_list_nodes
```
Expected: Shows 1 node (docker-desktop)

### 4. List Pods
```
Use k8s_list_pods with namespace="kube-system"
```
Expected: Shows Docker Desktop system pods

## Common Issues

### Issue: "No current context found"
**Fix:**
```bash
kubectl config use-context docker-desktop
```

### Issue: kubectl not found
**Fix:** Add Docker Desktop's kubectl to PATH:
- Windows: `C:\Program Files\Docker\Docker\resources\bin`
- Mac: `/Applications/Docker.app/Contents/Resources/bin`

### Issue: Connection refused
**Fix:** Ensure Kubernetes is running in Docker Desktop:
- Check Docker Desktop status bar shows "Kubernetes running"
- Restart Docker Desktop if needed

## Development Workflow

```bash
# 1. Build the MCP server
npm run build

# 2. Configure Claude Desktop (claude_desktop_config.json)
# Add the MCP server path

# 3. Test basic operations
# - List contexts
# - List pods
# - Deploy test application
```

## Testing Deployment

Deploy a test app to verify everything works:

```
Use k8s_apply_manifest with manifest:
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-test
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
```

Then verify:
```
Use k8s_list_pods with namespace="default"
```

## Local Development Tips

1. **Fast Feedback Loop**: Docker Desktop is local, so operations are fast
2. **No Cloud Costs**: Test freely without AWS/GCP charges
3. **Load Local Images**: Build images locally and deploy immediately
4. **Reset Easily**: Kubernetes reset in Docker Desktop settings if things break

## Advanced: Using Local Images

```bash
# Build image locally
docker build -t myapp:latest .

# Deploy to Docker Desktop Kubernetes
# (No registry needed - image is local)
```

Then use `k8s_apply_manifest` to deploy using `image: myapp:latest`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Context not found | Run `kubectl config use-context docker-desktop` |
| Connection timeout | Restart Docker Desktop |
| kubectl not found | Add Docker Desktop bin to PATH |
| Permission denied | Ensure kubeconfig has correct permissions |

## Next Steps

Once verified, you can:
- Deploy applications locally
- Test configurations before cloud deployment
- Learn Kubernetes operations safely
- Build and iterate quickly

---

## Project Documentation

| Document | Description |
|----------|-------------|
| **[README.md](README.md)** | Main documentation - Quick start, features, and examples |
| **[TOOLS_REFERENCE.md](TOOLS_REFERENCE.md)** | Complete tool reference with kubectl mappings and parameter details |
| **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** | Detailed API schemas and input/output examples |
| **[SECURITY.md](SECURITY.md)** | Security features, input sanitization, and secret scrubbing |
| **[PERFORMANCE_COMPARISON.md](PERFORMANCE_COMPARISON.md)** | Benchmarks and performance optimization details |
| **[CLOUD_PROVIDER_LIMITATIONS.md](CLOUD_PROVIDER_LIMITATIONS.md)** | Cloud provider specific limitations (AKS, GKE, EKS) |
| **[METRICS_SERVER.md](METRICS_SERVER.md)** | Metrics-server installation and configuration |
| **[DOCKER_DESKTOP_GUIDE.md](DOCKER_DESKTOP_GUIDE.md)** | Docker Desktop Kubernetes setup guide |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Contribution guidelines and development setup |
| **[CHANGELOG.md](CHANGELOG.md)** | Release history and notable changes |
| **[PRIVATE_REGISTRY_GUIDE.md](PRIVATE_REGISTRY_GUIDE.md)** | Private Helm and Docker registry configuration |
