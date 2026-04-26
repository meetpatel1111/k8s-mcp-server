# Private Registry Deployment Guide

This guide explains how to deploy applications using private container image registries with the k8s-mcp-server.

## Overview

When deploying applications from private container registries (Docker Hub, AWS ECR, GCR, Azure ACR, or private registries), Kubernetes needs authentication credentials to pull the images.

## Recommended Approach: Pre-existing Secret

For security best practices, create the secret manually using kubectl, then reference it in your deployment.

### Step 1: Create the Secret

**Docker Hub:**
```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=your-username \
  --docker-password=your-password
```

**AWS ECR:**
```bash
kubectl create secret docker-registry ecr-secret \
  --docker-server=<account-id>.dkr.ecr.<region>.amazonaws.com \
  --docker-username=AWS \
  --docker-password=<aws-access-key>
```

**Google GCR:**
```bash
kubectl create secret docker-registry gcr-secret \
  --docker-server=gcr.io \
  --docker-username=_json_key \
  --docker-password=<service-account-key>
```

**Azure ACR:**
```bash
kubectl create secret docker-registry acr-secret \
  --docker-server=<registry-name>.azurecr.io \
  --docker-username=<service-principal-id> \
  --docker-password=<service-principal-password>
```

**Private Registry:**
```bash
kubectl create secret docker-registry private-registry-secret \
  --docker-server=your-registry.com \
  --docker-username=your-username \
  --docker-password=your-password
```

### Step 2: Deploy with Claude

Tell Claude to use your existing secret:

```
Deploy nginx:latest from my private registry using the secret "dockerhub-secret"
```

Claude will execute:
```javascript
k8s_create_deployment({
  name: "nginx",
  image: "your-registry.com/nginx:latest",
  imagePullSecrets: ["dockerhub-secret"],
  namespace: "default"
})
```

## Alternative: Interactive Credential Creation

If you prefer, Claude can create the secret interactively.

### Workflow

1. **Claude asks for credentials:**
   - Registry URL
   - Username
   - Password

2. **You provide the credentials** in the conversation

3. **Claude creates the secret:**
   ```javascript
   k8s_create_secret({
     name: "my-registry-secret",
     type: "kubernetes.io/dockerconfigjson",
     dockerUsername: "your-username",
     dockerPassword: "your-password",
     dockerServer: "your-registry.com",
     namespace: "default"
   })
   ```

4. **Claude creates the deployment** referencing the secret

### Example Conversation

**User:** Deploy my-app:1.0 from registry.example.com

**Claude:** I'll need your registry credentials to pull from registry.example.com. Please provide:
- Username
- Password
- Registry URL (if different from registry.example.com)

**User:** Username: myuser, Password: mypass, URL: registry.example.com

**Claude:** [Creates secret and deployment]

## Security Considerations

### Why Pre-existing Secret is Recommended

- **Credentials never shared with AI:** Your credentials stay in your shell history
- **Standard Kubernetes practice:** Follows security best practices
- **Reusability:** Use the same secret across multiple deployments
- **Audit trail:** Secret creation is logged in your infrastructure

### Secret Management Best Practices

1. **Use service accounts** instead of personal credentials when possible
2. **Rotate credentials regularly** and update secrets
3. **Limit secret access** to specific namespaces using RBAC
4. **Use Kubernetes secrets** - don't hardcode credentials in deployment manifests
5. **Consider external secret managers** (HashiCorp Vault, AWS Secrets Manager) for production

## Troubleshooting

### ImagePullBackOff Error

If pods fail with `ImagePullBackOff`:

1. **Check the secret exists:**
   ```
   kubectl get secret <secret-name> -n <namespace>
   ```

2. **Verify secret is referenced in deployment:**
   ```
   kubectl get deployment <deployment-name> -o yaml | grep imagePullSecrets
   ```

3. **Check pod events:**
   ```
   kubectl describe pod <pod-name> -n <namespace>
   ```

4. **Test credentials:**
   ```bash
   docker login <registry-url> -u <username> -p <password>
   docker pull <image-name>
   ```

### Secret Not Found

If you get "secret not found" error:

1. Ensure secret is in the same namespace as the deployment
2. Check the secret name matches exactly (case-sensitive)
3. Verify the secret was created successfully

### Invalid Credentials

If credentials are invalid:

1. Update the secret:
   ```bash
   kubectl delete secret <secret-name> -n <namespace>
   kubectl create secret docker-registry <secret-name> \
     --docker-server=<registry> \
     --docker-username=<username> \
     --docker-password=<password> \
     -n <namespace>
   ```

2. Restart the deployment to pick up new credentials:
   ```
   kubectl rollout restart deployment <deployment-name> -n <namespace>
   ```

## Multi-Registry Deployments

If your application uses images from multiple registries:

```javascript
// Create secrets for each registry
k8s_create_secret({
  name: "dockerhub-secret",
  type: "kubernetes.io/dockerconfigjson",
  dockerUsername: "dockerhub-user",
  dockerPassword: "dockerhub-pass",
  dockerServer: "docker.io"
})

k8s_create_secret({
  name: "ecr-secret",
  type: "kubernetes.io/dockerconfigjson",
  dockerUsername: "AWS",
  dockerPassword: "aws-key",
  dockerServer: "123456.dkr.ecr.us-east-1.amazonaws.com"
})

// Deploy with multiple imagePullSecrets
k8s_create_deployment({
  name: "multi-registry-app",
  image: "docker.io/app:latest",
  imagePullSecrets: ["dockerhub-secret", "ecr-secret"]
})
```

## Service Account Integration

For more complex scenarios, you can attach secrets to service accounts:

```javascript
// Create service account
k8s_create_serviceaccount({
  name: "app-service-account",
  namespace: "default"
})

// Attach secret to service account
k8s_annotate({
  resource: "serviceaccount",
  name: "app-service-account",
  annotations: {
    "kubernetes.io/dockerconfigjson": "dockerhub-secret"
  }
})

// Use service account in deployment
k8s_create_deployment({
  name: "app",
  image: "docker.io/app:latest",
  serviceAccount: "app-service-account"
})
```

## Cloud-Specific Examples

### AWS ECR with IAM Roles

For AWS ECR, consider using IAM roles for service accounts (IRSA):

1. Create IAM role with ECR permissions
2. Associate IAM role with Kubernetes service account
3. No secret needed - authentication handled automatically

### Google GCR with Workload Identity

For GCR, use Workload Identity Federation:

1. Configure Google Cloud Workload Identity
2. Create Kubernetes service account with GSA annotation
3. Authentication handled by Google Cloud SDK

### Azure ACR with Managed Identity

For Azure ACR, use managed identity:

1. Enable ACR admin user or use managed identity
2. Configure pod identity
3. Authentication handled by Azure AD

## Summary

- **Recommended:** Create secrets manually with kubectl, then reference them
- **Alternative:** Let Claude create secrets interactively
- **Security:** Never share credentials in AI conversations when possible
- **Best Practice:** Use service accounts and external secret managers for production
