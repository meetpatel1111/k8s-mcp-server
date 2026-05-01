#!/usr/bin/env node
/**
 * API Documentation Generator
 * 
 * Automatically generates API documentation from tool schemas
 * Usage: npm run generate-docs
 */

import * as fs from 'fs';
import * as path from 'path';

// Import all tool registration functions
import { registerClusterTools } from '../src/k8s-tools/cluster.js';
import { registerConfigTools } from '../src/k8s-tools/config.js';
import { registerDiagnosticsTools } from '../src/k8s-tools/diagnostics.js';
import { registerMonitoringTools } from '../src/k8s-tools/monitoring.js';
import { registerNetworkingTools } from '../src/k8s-tools/networking.js';
import { registerNodeTools } from '../src/k8s-tools/nodes.js';
import { registerPodTools } from '../src/k8s-tools/pods.js';
import { registerSecurityTools } from '../src/k8s-tools/security.js';
import { registerStorageTools } from '../src/k8s-tools/storage.js';
import { registerTemplateTools } from '../src/k8s-tools/templates.js';
import { registerWebSocketTools } from '../src/k8s-tools/websocket.js';
import { registerWorkloadTools } from '../src/k8s-tools/workloads.js';
import { registerAdvancedTools } from '../src/k8s-tools/advanced.js';
import { registerMultiClusterTools } from '../src/k8s-tools/multi-cluster.js';

import { registerHelmChartManagementTools } from '../src/helm-tools/chart-management.js';
import { registerHelmChartTemplateTools } from '../src/helm-tools/chart-template.js';
import { registerHelmDependencyManagementTools } from '../src/helm-tools/dependency-management.js';
import { registerHelmEnvironmentTools } from '../src/helm-tools/environment.js';
import { registerHelmPluginManagementTools } from '../src/helm-tools/plugin-management.js';
import { registerHelmRegistryManagementTools } from '../src/helm-tools/registry-management.js';
import { registerHelmReleaseGetInfoTools } from '../src/helm-tools/release-get-info.js';
import { registerHelmReleaseGetValuesTools } from '../src/helm-tools/release-get-values.js';
import { registerHelmReleaseHistoryTools } from '../src/helm-tools/release-history.js';
import { registerHelmReleaseInstallTools } from '../src/helm-tools/release-install.js';
import { registerHelmReleaseListTools } from '../src/helm-tools/release-list.js';
import { registerHelmReleaseRollbackTools } from '../src/helm-tools/release-rollback.js';
import { registerHelmReleaseStatusTools } from '../src/helm-tools/release-status.js';
import { registerHelmReleaseTestTools } from '../src/helm-tools/release-test.js';
import { registerHelmReleaseUninstallTools } from '../src/helm-tools/release-uninstall.js';
import { registerHelmReleaseUpgradeTools } from '../src/helm-tools/release-upgrade.js';
import { registerHelmRepoManagementTools } from '../src/helm-tools/repo-management.js';
import { registerHelmSearchHubTools } from '../src/helm-tools/search-hub.js';
import { registerHelmShowChartTools } from '../src/helm-tools/show-chart.js';

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  inputSchema: any;
}

interface ToolRegistration {
  tool: {
    name: string;
    description?: string;
    inputSchema: any;
  };
  handler: Function;
}

interface ToolCategory {
  name: string;
  description: string;
  tools: ToolInfo[];
}

// Mock K8sClient for tool registration
class MockK8sClient {
  constructor() {}
  getCoreV1Api() { return {}; }
  getAppsV1Api() { return {}; }
  getBatchV1Api() { return {}; }
  getNetworkingV1Api() { return {}; }
  getStorageV1Api() { return {}; }
  getRbacV1Api() { return {}; }
  getClusterVersion() { return {}; }
  listNodes() { return []; }
  listNamespaces() { return []; }
  listPods() { return []; }
  listDeployments() { return []; }
  listServices() { return []; }
  listPVCs() { return []; }
  listConfigMaps() { return []; }
  listEvents() { return []; }
  getPod() { return {}; }
  getDeployment() { return {}; }
  getContexts() { return []; }
  getCurrentContext() { return ""; }
  getComponentStatuses() { return []; }
  withContext(ctx: string, op: Function) { return op(); }
  rawApiRequest() { return {}; }
  get kc() { return { 
    makeApiClient: () => ({}),
    getCurrentContext: () => "",
    getCurrentCluster: () => ({}),
    getContexts: () => [],
  }; }
}

function extractProperties(schema: any, indent: string = ''): string {
  if (!schema || !schema.properties) {
    return '';
  }

  const lines: string[] = [];
  const required = schema.required || [];

  for (const [key, value] of Object.entries<any>(schema.properties)) {
    const isRequired = required.includes(key);
    const type = value.type || 'any';
    const description = value.description || '';
    const defaultValue = value.default !== undefined ? ` (default: ${JSON.stringify(value.default)})` : '';
    const enumValues = value.enum ? ` [enum: ${value.enum.join(', ')}]` : '';

    lines.push(`${indent}- **${key}** (${type}${isRequired ? ', required' : 'optional'})${defaultValue}${enumValues}: ${description}`);

    if (type === 'object' && value.properties) {
      lines.push(extractProperties(value, indent + '  '));
    }

    if (type === 'array' && value.items) {
      if (value.items.type === 'object' && value.items.properties) {
        lines.push(`${indent}  Items:`);
        lines.push(extractProperties(value.items, indent + '    '));
      } else {
        lines.push(`${indent}  Items: ${value.items.type}`);
      }
    }
  }

  return lines.join('\n');
}

function generateToolMarkdown(tool: ToolInfo): string {
  const lines: string[] = [];
  lines.push(`### ${tool.name}`);
  lines.push('');
  lines.push(tool.description);
  lines.push('');

  if (tool.inputSchema && tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0) {
    lines.push('**Parameters:**');
    lines.push('');
    lines.push(extractProperties(tool.inputSchema));
    lines.push('');
  } else {
    lines.push('**Parameters:** None');
    lines.push('');
  }

  return lines.join('\n');
}

function generateCategoryMarkdown(category: ToolCategory): string {
  const lines: string[] = [];
  lines.push(`## ${category.name}`);
  lines.push('');
  lines.push(category.description);
  lines.push('');
  lines.push(`**Total Tools:** ${category.tools.length}`);
  lines.push('');

  for (const tool of category.tools) {
    lines.push(generateToolMarkdown(tool));
  }

  return lines.join('\n');
}

function generateApiDocs(): string {
  const mockClient = new MockK8sClient();
  const categories: ToolCategory[] = [];

  const k8sCategories = [
    { name: 'Cluster Tools', register: registerClusterTools, description: 'Kubernetes cluster management and context operations' },
    { name: 'Config Tools', register: registerConfigTools, description: 'Kubeconfig management and configuration operations' },
    { name: 'Diagnostics Tools', register: registerDiagnosticsTools, description: 'Cluster health checks and diagnostic utilities' },
    { name: 'Monitoring Tools', register: registerMonitoringTools, description: 'Resource monitoring and metrics collection' },
    { name: 'Networking Tools', register: registerNetworkingTools, description: 'Network-related resources and operations' },
    { name: 'Nodes Tools', register: registerNodeTools, description: 'Node management and operations' },
    { name: 'Pod Tools', register: registerPodTools, description: 'Pod lifecycle management and operations' },
    { name: 'Security Tools', register: registerSecurityTools, description: 'RBAC, secrets, and security-related operations' },
    { name: 'Storage Tools', register: registerStorageTools, description: 'Persistent volumes, claims, and storage operations' },
    { name: 'Templates Tools', register: registerTemplateTools, description: 'Deployment templates and quick deployment utilities' },
    { name: 'WebSocket Tools', register: registerWebSocketTools, description: 'Real-time streaming, exec, and port forwarding' },
    { name: 'Workloads Tools', register: registerWorkloadTools, description: 'Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs' },
    { name: 'Multi-Cluster Tools', register: registerMultiClusterTools, description: 'Operations across multiple clusters and contexts' },
    { name: 'Advanced Tools', register: registerAdvancedTools, description: 'Advanced operations including batch processing and resource comparison' },
  ];

  for (const cat of k8sCategories) {
    const tools = (cat.register as any)(mockClient);
    categories.push({
      name: cat.name,
      description: cat.description,
      tools: tools.map((t: ToolRegistration) => ({
        name: t.tool.name,
        description: t.tool.description || '',
        category: cat.name,
        inputSchema: t.tool.inputSchema,
      })),
    });
  }

  const helmCategories = [
    { name: 'Helm Chart Management', register: registerHelmChartManagementTools, description: 'Helm chart creation, packaging, linting, and verification' },
    { name: 'Helm Chart Template', register: registerHelmChartTemplateTools, description: 'Helm chart template rendering' },
    { name: 'Helm Dependency Management', register: registerHelmDependencyManagementTools, description: 'Helm chart dependency operations' },
    { name: 'Helm Environment', register: registerHelmEnvironmentTools, description: 'Helm environment and version information' },
    { name: 'Helm Plugin Management', register: registerHelmPluginManagementTools, description: 'Helm plugin installation and management' },
    { name: 'Helm Registry Management', register: registerHelmRegistryManagementTools, description: 'OCI registry login/logout and chart push' },
    { name: 'Helm Release Get Info', register: registerHelmReleaseGetInfoTools, description: 'Get release manifests, notes, hooks, and metadata' },
    { name: 'Helm Release Get Values', register: registerHelmReleaseGetValuesTools, description: 'Get Helm release values' },
    { name: 'Helm Release History', register: registerHelmReleaseHistoryTools, description: 'Helm release history operations' },
    { name: 'Helm Release Install', register: registerHelmReleaseInstallTools, description: 'Install Helm charts into Kubernetes' },
    { name: 'Helm Release List', register: registerHelmReleaseListTools, description: 'List and search Helm releases' },
    { name: 'Helm Release Rollback', register: registerHelmReleaseRollbackTools, description: 'Roll back Helm releases to previous versions' },
    { name: 'Helm Release Status', register: registerHelmReleaseStatusTools, description: 'Get Helm release status information' },
    { name: 'Helm Release Test', register: registerHelmReleaseTestTools, description: 'Run Helm release tests' },
    { name: 'Helm Release Uninstall', register: registerHelmReleaseUninstallTools, description: 'Uninstall Helm releases' },
    { name: 'Helm Release Upgrade', register: registerHelmReleaseUpgradeTools, description: 'Upgrade Helm releases to new versions' },
    { name: 'Helm Repo Management', register: registerHelmRepoManagementTools, description: 'Helm repository management' },
    { name: 'Helm Search Hub', register: registerHelmSearchHubTools, description: 'Search for Helm charts in Artifact Hub and repositories' },
    { name: 'Helm Show Chart', register: registerHelmShowChartTools, description: 'Show Helm chart information' },
  ];

  for (const cat of helmCategories) {
    const tools = (cat.register as any)(mockClient);
    categories.push({
      name: cat.name,
      description: cat.description,
      tools: tools.map((t: ToolRegistration) => ({
        name: t.tool.name,
        description: t.tool.description || '',
        category: cat.name,
        inputSchema: t.tool.inputSchema,
      })),
    });
  }

  const lines: string[] = [];
  lines.push('# API Documentation');
  lines.push('');
  lines.push('This document provides auto-generated API documentation for all Kubernetes and Helm tools.');
  lines.push('');
  lines.push('**Generated:** ' + new Date().toISOString());
  lines.push('');

  const totalTools = categories.reduce((sum, cat) => sum + cat.tools.length, 0);
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Tools:** ${totalTools}`);
  lines.push(`- **Categories:** ${categories.length}`);
  lines.push(`- **Kubernetes Tools:** ${k8sCategories.length} categories`);
  lines.push(`- **Helm Tools:** ${helmCategories.length} categories`);
  lines.push('');

  lines.push('## Table of Contents');
  lines.push('');
  for (const category of categories) {
    const anchor = category.name.toLowerCase().replace(/\s+/g, '-');
    lines.push(`- [${category.name}](#${anchor}) (${category.tools.length} tools)`);
  }
  lines.push('');

  for (const category of categories) {
    lines.push(generateCategoryMarkdown(category));
  }

  return lines.join('\n');
}

function main() {
  console.log('Generating API documentation...');
  try {
    const docs = generateApiDocs();
    const outputPath = path.join(process.cwd(), 'API_DOCUMENTATION.md');
    fs.writeFileSync(outputPath, docs, 'utf-8');
    console.log(`✓ API documentation generated: ${outputPath}`);
    console.log(`- Total tools documented: ${docs.split('### ').length - 1}`);
  } catch (error) {
    console.error('Error generating documentation:', error);
    process.exit(1);
  }
}

main();
