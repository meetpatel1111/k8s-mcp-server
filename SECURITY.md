# Security and Data Protection Guide

This document explains the security architecture, data protection mechanisms, and safety features of the k8s-mcp-server.

## Overview

The k8s-mcp-server is designed with security as a primary concern. It acts as a secure proxy between Claude and your Kubernetes cluster, ensuring that sensitive credentials and configuration data are never exposed to the AI.

## Security Architecture

### Data Flow

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Claude    │         │  k8s-mcp-server  │         │ Kubernetes API  │
│  (AI Client)│────────▶│  (Local Proxy)   │────────▶│  (Cluster)      │
└─────────────┘         └──────────────────┘         └─────────────────┘
                            │
                            ├─ Reads kubeconfig locally
                            ├─ Stores credentials in memory
                            ├─ Authenticates with Kubernetes
                            ├─ Executes operations
                            └─ Returns results only
```

### What Claude Sees

**Claude has access to:**
- Tool names and descriptions
- Tool input parameters (namespace, pod name, resource names)
- Tool output results (pod status, logs, resource configurations)
- Error messages and operation results

**Claude does NOT have access to:**
- Kubeconfig file contents
- API tokens and certificates
- Authentication credentials
- Cluster connection details (server URLs, CA certificates)
- User credentials or service account tokens
- Private registry credentials (when using pre-existing secrets)

### What the MCP Server Handles Locally

**The server processes locally:**
- Reading and parsing kubeconfig files
- Storing authentication credentials in memory
- Establishing TLS connections to Kubernetes API
- Handling certificate validation
- Managing authentication tokens
- Executing Kubernetes API calls
- Applying protection mode rules

## Credential Management

### Kubeconfig Security

**How kubeconfig is handled:**
1. Server reads kubeconfig from standard location (`~/.kube/config`)
2. Credentials are loaded into memory only
3. Credentials are never logged or transmitted to Claude
4. Credentials are never written to disk by the server
5. Memory is cleared when server shuts down

**Supported authentication methods:**
- Client certificates
- Bearer tokens
- Basic authentication
- Exec-based authentication (e.g., AWS IAM, GKE)
- OIDC authentication

### Private Registry Credentials

**Recommended approach (secure):**
```bash
# Create secret manually - credentials never shared with Claude
kubectl create secret docker-registry my-registry-secret \
  --docker-server=registry.example.com \
  --docker-username=your-username \
  --docker-password=your-password
```

**Alternative (less secure):**
- Claude can create secrets interactively
- User provides credentials in conversation
- Credentials are stored in Kubernetes secrets
- **Note:** This approach shares credentials with Claude

## Protection Modes

The server includes two protection modes to prevent accidental or malicious operations:

### Infrastructure Protection Mode

**Purpose:** Prevent destructive operations on critical infrastructure

**Protected tools (when enabled):**
- Node operations (cordon, drain, delete)
- Cluster-wide operations
- Storage operations (PV deletion)
- Critical configuration changes

**How it works:**
- Enabled by default
- Blocks destructive tools by default
- Requires explicit confirmation to disable
- Logs all blocked attempts

**Configuration:**
```bash
export INFRA_PROTECTION_MODE=true  # Enable (default: true)
export INFRA_PROTECTION_MODE=false # Disable protection
```

### Strict Protection Mode

**Purpose:** Blocks ALL non-read-only operations - highest level of protection

**What it blocks:**
- All modification operations (create, update, delete)
- Only allows list, get, describe, and monitoring operations
- Useful for production clusters where no modifications should ever be made

**Configuration:**
```bash
export STRICT_PROTECTION_MODE=true  # Enable (default: false)
export STRICT_PROTECTION_MODE=false # Disable
```

**Tool:** `k8s_toggle_strict_protection_mode`

### No Delete Protection Mode

**Purpose:** Blocks only deletion operations while allowing other modifications

**What it blocks:**
- Delete operations only
- Allows create, update, scale, and modify operations
- Useful for environments where modifications are needed but accidental deletions must be prevented

**Configuration:**
```bash
export NO_DELETE_PROTECTION_MODE=true  # Enable (default: false)
export NO_DELETE_PROTECTION_MODE=false # Disable
```

**Tool:** `k8s_toggle_no_delete_mode`

### Master Toggle

**Tool:** `k8s_toggle_all_protection_modes`

Controls all three protection modes simultaneously for quick switching between full access and fully protected states.

## Data Protection

### Data in Transit

**TLS/SSL encryption:**
- All communication between MCP server and Kubernetes API uses TLS
- Certificate validation is enforced by default
- Custom CA certificates are supported
- Secure by default configuration

**Communication with Claude:**
- Uses stdio (standard input/output) for local communication
- No network exposure to Claude
- Claude Desktop runs locally on your machine

### Data at Rest

**Kubernetes secrets:**
- The server does not create secrets unless explicitly requested
- When creating secrets, they are stored in Kubernetes
- Kubernetes secrets are encrypted at rest (cluster-dependent)
- Server does not persist secrets locally

**Local storage:**
- No credential storage on disk
- No logging of sensitive data
- Temporary files are cleaned up
- Memory-only credential storage

### Data in Memory

**Credential storage:**
- Credentials stored in process memory only
- Memory is cleared on server shutdown
- No memory dumps or core dumps with credentials
- Credentials never swapped to disk

**Session isolation:**
- Each server instance has isolated memory
- No credential sharing between sessions
- Restart clears all credentials

## Security Best Practices

### For Users

1. **Use pre-existing secrets for private registries**
   - Create secrets manually with kubectl
   - Reference secrets in deployments
   - Avoid sharing credentials with Claude

2. **Enable protection modes**
   - Keep infrastructure protection enabled
   - Configure multi-mode protection for your environment
   - Review protection mode settings regularly

3. **Limit cluster access**
   - Use service accounts with minimal permissions
   - Apply RBAC policies to restrict access
   - Use separate kubeconfig for MCP server

4. **Audit access**
   - Review Kubernetes audit logs
   - Monitor MCP server logs for suspicious activity
   - Track tool usage patterns

5. **Keep server updated**
   - Install security updates promptly
   - Review changelog for security fixes
   - Monitor GitHub issues for security reports

### For Administrators

1. **Network security**
   - Run MCP server in secure network environment
   - Use firewall rules to restrict access
   - Implement network policies in Kubernetes

2. **Credential management**
   - Rotate credentials regularly
   - Use short-lived tokens
   - Implement credential rotation policies
   - Use external secret managers

3. **Monitoring and alerting**
   - Enable Kubernetes audit logging
   - Monitor for unusual API calls
   - Set up alerts for protection mode triggers
   - Track resource usage patterns

4. **Compliance**
   - Review logs for compliance requirements
   - Implement retention policies
   - Ensure audit trail completeness
   - Document security procedures

## Risk Assessment

### Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Credential exposure to Claude | Low | High | Server handles credentials locally; Claude only sees tool interface |
| Accidental cluster modification | Medium | High | Protection modes enabled by default |
| Malicious tool usage | Low | High | Protection modes; audit logging |
| Unauthorized cluster access | Low | High | RBAC; credential management |
| Data leakage through logs | Low | Medium | No sensitive data logging |
| Man-in-the-middle attacks | Low | High | TLS enforcement; certificate validation |

### Risk Mitigation

**Credential exposure:**
- Server architecture prevents credential exposure
- Credentials never transmitted to Claude
- Memory-only credential storage
- Regular security audits

**Accidental modifications:**
- Infrastructure protection mode enabled by default
- Multi-mode protection for fine-grained control
- Confirmation required for destructive operations
- Audit logging of all operations

**Unauthorized access:**
- RBAC enforcement
- Service account isolation
- Network policies
- Credential rotation

## Audit and Logging

### Server Logging

**What is logged:**
- Tool invocations (name, parameters)
- Operation results (success/failure)
- Protection mode triggers
- Error messages (no sensitive data)
- Server startup and shutdown

**What is NOT logged:**
- Credentials
- API tokens
- Certificate contents
- Secret values
- Sensitive configuration data

### Kubernetes Audit Logging

**Enable audit logging:**
```yaml
# Kubernetes audit policy
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  resources:
  - group: ""
    resources: ["pods", "deployments", "services"]
```

**Monitor audit logs:**
```bash
kubectl get events --all-namespaces
kubectl logs -n kube-system -l component=kube-apiserver
```

## Compliance Considerations

### Data Residency

- Server runs locally on your machine
- No data transmitted to external services
- Kubernetes cluster controls data residency
- Compliance depends on your cluster configuration

### Access Control

- MCP server respects Kubernetes RBAC
- Service account permissions enforced
- No privilege escalation
- Namespace isolation maintained

### Audit Trail

- Kubernetes audit logs provide complete trail
- Server logs supplement with tool-level tracking
- Protection mode triggers logged
- All operations attributable to user context

## Incident Response

### If Credentials Are Compromised

1. **Immediate actions:**
   - Rotate all affected credentials
   - Revoke compromised tokens
   - Update kubeconfig
   - Restart MCP server

2. **Investigation:**
   - Review audit logs
   - Check Kubernetes API logs
   - Identify affected resources
   - Assess impact scope

3. **Recovery:**
   - Restore from backups if needed
   - Update security policies
   - Implement additional protections
   - Document lessons learned

### If Unauthorized Access Detected

1. **Containment:**
   - Disable MCP server
   - Revoke service account permissions
   - Isolate affected cluster
   - Enable additional monitoring

2. **Investigation:**
   - Review all logs
   - Identify access patterns
   - Determine attack vector
   - Assess data exposure

3. **Remediation:**
   - Patch vulnerabilities
   - Update configurations
   - Strengthen access controls
   - Implement additional safeguards

## Security Checklist

- [ ] Infrastructure protection mode enabled
- [ ] Multi-mode protection configured
- [ ] RBAC policies applied
- [ ] Service account with minimal permissions
- [ ] Kubernetes audit logging enabled
- [ ] Regular credential rotation
- [ ] Pre-existing secrets for private registries
- [ ] TLS/SSL enforced for API communication
- [ ] Network policies configured
- [ ] Monitoring and alerting setup
- [ ] Security review completed
- [ ] Incident response plan documented

## Additional Resources

- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/security-checklist/)
- [Kubernetes Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Secrets Management](https://kubernetes.io/docs/concepts/configuration/secret/)

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create a public GitHub issue
2. Email: pmeet464@gmail.com
3. Include details of the vulnerability
4. Allow time for the issue to be addressed
5. Coordinate disclosure timeline

## Summary

The k8s-mcp-server is designed with security as a foundational principle:

- **Credentials never exposed to Claude** - handled locally by the server
- **Protection modes prevent accidents** - enabled by default
- **TLS encryption for all communications** - secure by default
- **Audit logging for accountability** - complete operation trail
- **RBAC enforcement** - respects Kubernetes access controls
- **Memory-only credential storage** - no persistence of sensitive data

By following the security best practices outlined in this guide, you can ensure safe and secure operation of the k8s-mcp-server in your environment.
