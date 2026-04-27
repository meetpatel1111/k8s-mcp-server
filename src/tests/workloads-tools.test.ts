import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerWorkloadTools } from '../k8s-tools/workloads.js';
import { K8sClient } from '../k8s-client.js';

describe('Workloads Tools', () => {
  let mockK8sClient: K8sClient;

  beforeEach(() => {
    mockK8sClient = new K8sClient();
  });

  describe('registerWorkloadTools', () => {
    it('should register workload tools', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should register k8s_list_deployments tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const listDeploymentsTool = tools.find(t => t.tool.name === 'k8s_list_deployments');
      expect(listDeploymentsTool).toBeDefined();
      expect(listDeploymentsTool?.tool.description).toBe('List all deployments');
      expect(listDeploymentsTool?.tool.inputSchema).toBeDefined();
      expect(listDeploymentsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getDeploymentTool = tools.find(t => t.tool.name === 'k8s_get_deployment');
      expect(getDeploymentTool).toBeDefined();
      expect(getDeploymentTool?.tool.description).toBe('Get detailed information about a deployment');
      expect(getDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(getDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createDeploymentTool = tools.find(t => t.tool.name === 'k8s_create_deployment');
      expect(createDeploymentTool).toBeDefined();
      expect(createDeploymentTool?.tool.description).toBe('Create a deployment imperatively (like kubectl create deployment)');
      expect(createDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(createDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const deleteDeploymentTool = tools.find(t => t.tool.name === 'k8s_delete_deployment');
      expect(deleteDeploymentTool).toBeDefined();
      expect(deleteDeploymentTool?.tool.description).toBe('Delete a Deployment');
      expect(deleteDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(deleteDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_scale_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const scaleDeploymentTool = tools.find(t => t.tool.name === 'k8s_scale_deployment');
      expect(scaleDeploymentTool).toBeDefined();
      expect(scaleDeploymentTool?.tool.description).toBe('Scale a deployment to a specific number of replicas');
      expect(scaleDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(scaleDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_restart_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const restartDeploymentTool = tools.find(t => t.tool.name === 'k8s_restart_deployment');
      expect(restartDeploymentTool).toBeDefined();
      expect(restartDeploymentTool?.tool.description).toBe('Perform a rolling restart of a deployment');
      expect(restartDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(restartDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_rollback_deployment tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const rollbackDeploymentTool = tools.find(t => t.tool.name === 'k8s_rollback_deployment');
      expect(rollbackDeploymentTool).toBeDefined();
      expect(rollbackDeploymentTool?.tool.description).toBe('Rollback a deployment to a previous revision');
      expect(rollbackDeploymentTool?.tool.inputSchema).toBeDefined();
      expect(rollbackDeploymentTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_rollout_history tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const rolloutHistoryTool = tools.find(t => t.tool.name === 'k8s_rollout_history');
      expect(rolloutHistoryTool).toBeDefined();
      expect(rolloutHistoryTool?.tool.description).toBe('View rollout history for a deployment');
      expect(rolloutHistoryTool?.tool.inputSchema).toBeDefined();
      expect(rolloutHistoryTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_deployment_rollout_status tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const rolloutStatusTool = tools.find(t => t.tool.name === 'k8s_deployment_rollout_status');
      expect(rolloutStatusTool).toBeDefined();
      expect(rolloutStatusTool?.tool.description).toBe('Check the rollout status of a deployment');
      expect(rolloutStatusTool?.tool.inputSchema).toBeDefined();
      expect(rolloutStatusTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_statefulsets tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const listStatefulSetsTool = tools.find(t => t.tool.name === 'k8s_list_statefulsets');
      expect(listStatefulSetsTool).toBeDefined();
      expect(listStatefulSetsTool?.tool.description).toBe('List all StatefulSets');
      expect(listStatefulSetsTool?.tool.inputSchema).toBeDefined();
      expect(listStatefulSetsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_statefulset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getStatefulSetTool = tools.find(t => t.tool.name === 'k8s_get_statefulset');
      expect(getStatefulSetTool).toBeDefined();
      expect(getStatefulSetTool?.tool.description).toBe('Get detailed information about a StatefulSet');
      expect(getStatefulSetTool?.tool.inputSchema).toBeDefined();
      expect(getStatefulSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_statefulset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createStatefulSetTool = tools.find(t => t.tool.name === 'k8s_create_statefulset');
      expect(createStatefulSetTool).toBeDefined();
      expect(createStatefulSetTool?.tool.description).toBe('Create a StatefulSet (like kubectl create statefulset). StatefulSets are used for applications that require stable network identity and persistent storage.');
      expect(createStatefulSetTool?.tool.inputSchema).toBeDefined();
      expect(createStatefulSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_statefulset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const deleteStatefulSetTool = tools.find(t => t.tool.name === 'k8s_delete_statefulset');
      expect(deleteStatefulSetTool).toBeDefined();
      expect(deleteStatefulSetTool?.tool.description).toBe('Delete a StatefulSet');
      expect(deleteStatefulSetTool?.tool.inputSchema).toBeDefined();
      expect(deleteStatefulSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_restart_statefulset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const restartStatefulSetTool = tools.find(t => t.tool.name === 'k8s_restart_statefulset');
      expect(restartStatefulSetTool).toBeDefined();
      expect(restartStatefulSetTool?.tool.description).toBe('Restart a StatefulSet by updating its pod template (like kubectl rollout restart statefulset)');
      expect(restartStatefulSetTool?.tool.inputSchema).toBeDefined();
      expect(restartStatefulSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_daemonsets tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const listDaemonSetsTool = tools.find(t => t.tool.name === 'k8s_list_daemonsets');
      expect(listDaemonSetsTool).toBeDefined();
      expect(listDaemonSetsTool?.tool.description).toBe('List all DaemonSets');
      expect(listDaemonSetsTool?.tool.inputSchema).toBeDefined();
      expect(listDaemonSetsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_daemonset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getDaemonSetTool = tools.find(t => t.tool.name === 'k8s_get_daemonset');
      expect(getDaemonSetTool).toBeDefined();
      expect(getDaemonSetTool?.tool.description).toBe('Get detailed information about a DaemonSet');
      expect(getDaemonSetTool?.tool.inputSchema).toBeDefined();
      expect(getDaemonSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_daemonset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createDaemonSetTool = tools.find(t => t.tool.name === 'k8s_create_daemonset');
      expect(createDaemonSetTool).toBeDefined();
      expect(createDaemonSetTool?.tool.description).toBe('Create a DaemonSet (like kubectl create daemonset). DaemonSets run a pod on every node (or matching nodes), useful for log collectors, monitoring agents, etc.');
      expect(createDaemonSetTool?.tool.inputSchema).toBeDefined();
      expect(createDaemonSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_daemonset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const deleteDaemonSetTool = tools.find(t => t.tool.name === 'k8s_delete_daemonset');
      expect(deleteDaemonSetTool).toBeDefined();
      expect(deleteDaemonSetTool?.tool.description).toBe('Delete a DaemonSet');
      expect(deleteDaemonSetTool?.tool.inputSchema).toBeDefined();
      expect(deleteDaemonSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_restart_daemonset tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const restartDaemonSetTool = tools.find(t => t.tool.name === 'k8s_restart_daemonset');
      expect(restartDaemonSetTool).toBeDefined();
      expect(restartDaemonSetTool?.tool.description).toBe('Restart a DaemonSet by updating its pod template (like kubectl rollout restart daemonset)');
      expect(restartDaemonSetTool?.tool.inputSchema).toBeDefined();
      expect(restartDaemonSetTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_jobs tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const listJobsTool = tools.find(t => t.tool.name === 'k8s_list_jobs');
      expect(listJobsTool).toBeDefined();
      expect(listJobsTool?.tool.description).toBe('List all Jobs');
      expect(listJobsTool?.tool.inputSchema).toBeDefined();
      expect(listJobsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_job tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getJobTool = tools.find(t => t.tool.name === 'k8s_get_job');
      expect(getJobTool).toBeDefined();
      expect(getJobTool?.tool.description).toBe('Get detailed information about a Job');
      expect(getJobTool?.tool.inputSchema).toBeDefined();
      expect(getJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_job tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createJobTool = tools.find(t => t.tool.name === 'k8s_create_job');
      expect(createJobTool).toBeDefined();
      expect(createJobTool?.tool.description).toBe('Create a job imperatively (like kubectl create job)');
      expect(createJobTool?.tool.inputSchema).toBeDefined();
      expect(createJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_job tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const deleteJobTool = tools.find(t => t.tool.name === 'k8s_delete_job');
      expect(deleteJobTool).toBeDefined();
      expect(deleteJobTool?.tool.description).toBe('Delete a Job');
      expect(deleteJobTool?.tool.inputSchema).toBeDefined();
      expect(deleteJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_list_cronjobs tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const listCronJobsTool = tools.find(t => t.tool.name === 'k8s_list_cronjobs');
      expect(listCronJobsTool).toBeDefined();
      expect(listCronJobsTool?.tool.description).toBe('List all CronJobs');
      expect(listCronJobsTool?.tool.inputSchema).toBeDefined();
      expect(listCronJobsTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_get_cronjob tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getCronJobTool = tools.find(t => t.tool.name === 'k8s_get_cronjob');
      expect(getCronJobTool).toBeDefined();
      expect(getCronJobTool?.tool.description).toBe('Get detailed information about a CronJob');
      expect(getCronJobTool?.tool.inputSchema).toBeDefined();
      expect(getCronJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_create_cronjob tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createCronJobTool = tools.find(t => t.tool.name === 'k8s_create_cronjob');
      expect(createCronJobTool).toBeDefined();
      expect(createCronJobTool?.tool.description).toBe('Create a cronjob imperatively (like kubectl create cronjob)');
      expect(createCronJobTool?.tool.inputSchema).toBeDefined();
      expect(createCronJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_delete_cronjob tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const deleteCronJobTool = tools.find(t => t.tool.name === 'k8s_delete_cronjob');
      expect(deleteCronJobTool).toBeDefined();
      expect(deleteCronJobTool?.tool.description).toBe('Delete a CronJob');
      expect(deleteCronJobTool?.tool.inputSchema).toBeDefined();
      expect(deleteCronJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should register k8s_trigger_job tool', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const triggerJobTool = tools.find(t => t.tool.name === 'k8s_trigger_job');
      expect(triggerJobTool).toBeDefined();
      expect(triggerJobTool?.tool.description).toBe('Manually trigger a CronJob to create a Job');
      expect(triggerJobTool?.tool.inputSchema).toBeDefined();
      expect(triggerJobTool?.handler).toBeInstanceOf(Function);
    });

    it('should have valid input schema for k8s_get_deployment', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const getDeploymentTool = tools.find(t => t.tool.name === 'k8s_get_deployment');
      const schema = getDeploymentTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.namespace).toBeDefined();
      expect(schema?.required).toContain('name');
    });

    it('should have valid input schema for k8s_create_deployment', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const createDeploymentTool = tools.find(t => t.tool.name === 'k8s_create_deployment');
      const schema = createDeploymentTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.image).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('image');
    });

    it('should have valid input schema for k8s_scale_deployment', () => {
      const tools = registerWorkloadTools(mockK8sClient);
      const scaleDeploymentTool = tools.find(t => t.tool.name === 'k8s_scale_deployment');
      const schema = scaleDeploymentTool?.tool.inputSchema;
      
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toBeDefined();
      expect(schema?.properties?.name).toBeDefined();
      expect(schema?.properties?.replicas).toBeDefined();
      expect(schema?.required).toContain('name');
      expect(schema?.required).toContain('replicas');
    });
  });
});
