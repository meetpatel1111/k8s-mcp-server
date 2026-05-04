/**
 * Unit tests for k8s_incident_snapshot.
 *
 * Strategy: mock the K8sClient surface that incident.ts depends on. We
 * cover (1) happy path, (2) one section failing while others succeed,
 * (3) classification of each pod failure mode, (4) severity scoring,
 * (5) input validation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  runIncidentSnapshot,
  IncidentSnapshotInput,
  type K8sClientLike,
} from '../incident.js';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

interface MockOpts {
  pods?: any[];
  events?: any[];
  deployments?: any[];
  statefulsets?: any[];
  daemonsets?: any[];
  nodes?: any[];
  validatingWebhooks?: any[];
  mutatingWebhooks?: any[];
  apiServices?: any[];
  services?: Record<string, boolean>; // "ns/name" -> exists
  failOn?: Partial<{
    pods: boolean;
    events: boolean;
    rollouts: boolean;
    nodes: boolean;
    webhooks: boolean;
  }>;
}

function makeClient(opts: MockOpts = {}): K8sClientLike {
  const ok = <T>(x: T) => Promise.resolve(x);
  const fail = (label: string) => () =>
    Promise.reject(new Error(`mock failure in ${label}`));

  const core = {
    listPodForAllNamespaces: opts.failOn?.pods
      ? fail('listPod')
      : () => ok({ items: opts.pods ?? [] }),
    listNamespacedPod: opts.failOn?.pods
      ? fail('listPod')
      : () => ok({ items: opts.pods ?? [] }),
    listEventForAllNamespaces: opts.failOn?.events
      ? fail('listEvent')
      : () => ok({ items: opts.events ?? [] }),
    listNamespacedEvent: opts.failOn?.events
      ? fail('listEvent')
      : () => ok({ items: opts.events ?? [] }),
    listNode: opts.failOn?.nodes
      ? fail('listNode')
      : () => ok({ items: opts.nodes ?? [] }),
    readNamespacedService: ({
      name,
      namespace,
    }: {
      name: string;
      namespace: string;
    }) => {
      const exists = opts.services?.[`${namespace}/${name}`] ?? true;
      return exists
        ? ok({ metadata: { name, namespace } })
        : Promise.reject(new Error('not found'));
    },
  } as any;

  const apps = {
    listDeploymentForAllNamespaces: opts.failOn?.rollouts
      ? fail('listDeploy')
      : () => ok({ items: opts.deployments ?? [] }),
    listNamespacedDeployment: opts.failOn?.rollouts
      ? fail('listDeploy')
      : () => ok({ items: opts.deployments ?? [] }),
    listStatefulSetForAllNamespaces: () =>
      ok({ items: opts.statefulsets ?? [] }),
    listNamespacedStatefulSet: () => ok({ items: opts.statefulsets ?? [] }),
    listDaemonSetForAllNamespaces: () => ok({ items: opts.daemonsets ?? [] }),
    listNamespacedDaemonSet: () => ok({ items: opts.daemonsets ?? [] }),
  } as any;

  const adm = {
    listValidatingWebhookConfiguration: opts.failOn?.webhooks
      ? fail('listVW')
      : () => ok({ items: opts.validatingWebhooks ?? [] }),
    listMutatingWebhookConfiguration: opts.failOn?.webhooks
      ? fail('listMW')
      : () => ok({ items: opts.mutatingWebhooks ?? [] }),
  } as any;

  const reg = {
    listAPIService: () => ok({ items: opts.apiServices ?? [] }),
  } as any;

  return {
    getCoreV1Api: () => core,
    getAppsV1Api: () => apps,
    getAdmissionregistrationV1Api: () => adm,
    getApiregistrationV1Api: () => reg,
    getCurrentContext: () => 'mock-context',
  };
}

// ---------------------------------------------------------------------------
// Pod fixtures
// ---------------------------------------------------------------------------

function pod(overrides: any): any {
  return {
    metadata: {
      name: 'p',
      namespace: 'default',
      creationTimestamp: new Date(Date.now() - 60_000).toISOString(),
    },
    status: { phase: 'Running' },
    ...overrides,
  };
}

const crashloopPod = pod({
  metadata: { name: 'crash', namespace: 'payments' },
  status: {
    phase: 'Running',
    containerStatuses: [
      {
        name: 'app',
        restartCount: 7,
        state: {
          waiting: { reason: 'CrashLoopBackOff', message: 'back-off 5m' },
        },
      },
    ],
  },
});

const imagePullPod = pod({
  metadata: { name: 'imgpull', namespace: 'payments' },
  status: {
    phase: 'Pending',
    containerStatuses: [
      {
        name: 'app',
        restartCount: 0,
        state: { waiting: { reason: 'ImagePullBackOff' } },
      },
    ],
  },
});

const oomPod = pod({
  metadata: { name: 'oom', namespace: 'payments' },
  status: {
    phase: 'Running',
    containerStatuses: [
      {
        name: 'app',
        restartCount: 3,
        state: { running: {} },
        lastState: { terminated: { reason: 'OOMKilled' } },
      },
    ],
  },
});

const evictedPod = pod({
  metadata: { name: 'evict', namespace: 'payments' },
  status: { phase: 'Failed', reason: 'Evicted' },
});

const healthyPod = pod({
  metadata: { name: 'healthy', namespace: 'payments' },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncidentSnapshotInput', () => {
  it('rejects invalid duration', () => {
    expect(() => IncidentSnapshotInput.parse({ since: 'forever' })).toThrow();
  });
  it('accepts valid durations', () => {
    expect(IncidentSnapshotInput.parse({ since: '30s' }).since).toBe('30s');
    expect(IncidentSnapshotInput.parse({ since: '15m' }).since).toBe('15m');
    expect(IncidentSnapshotInput.parse({ since: '2h' }).since).toBe('2h');
  });
  it('defaults since to 15m', () => {
    expect(IncidentSnapshotInput.parse({}).since).toBe('15m');
  });
});

describe('runIncidentSnapshot — pod classification', () => {
  it('groups unhealthy pods by failure mode', async () => {
    const client = makeClient({
      pods: [crashloopPod, imagePullPod, oomPod, evictedPod, healthyPod],
    });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.unhealthyPods.status).toBe('ok');
    const data = snap.unhealthyPods.data!;
    expect(data.totalUnhealthy).toBe(4);
    expect(data.byFailureMode.CrashLoopBackOff?.count).toBe(1);
    expect(data.byFailureMode.ImagePullBackOff?.count).toBe(1);
    expect(data.byFailureMode.OOMKilled?.count).toBe(1);
    expect(data.byFailureMode.Evicted?.count).toBe(1);
  });

  it('caps examples per category', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      pod({
        metadata: { name: `c${i}`, namespace: 'default' },
        status: {
          phase: 'Running',
          containerStatuses: [
            {
              name: 'app',
              restartCount: 1,
              state: { waiting: { reason: 'CrashLoopBackOff' } },
            },
          ],
        },
      }),
    );
    const client = makeClient({ pods: many });
    const snap = await runIncidentSnapshot(client, { maxPodsPerCategory: 5 });
    expect(snap.unhealthyPods.data!.byFailureMode.CrashLoopBackOff!.count).toBe(
      20,
    );
    expect(
      snap.unhealthyPods.data!.byFailureMode.CrashLoopBackOff!.examples.length,
    ).toBe(5);
  });
});

describe('runIncidentSnapshot — partial failures', () => {
  it('continues when pods listing fails', async () => {
    const client = makeClient({
      failOn: { pods: true },
      nodes: [],
    });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.unhealthyPods.status).toBe('unavailable');
    expect(snap.unhealthyPods.reason).toContain('mock failure');
    expect(snap.nodePressure.status).toBe('ok'); // others still work
  });

  it('continues when events listing fails', async () => {
    const client = makeClient({ failOn: { events: true } });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.recentEvents.status).toBe('unavailable');
    expect(snap.unhealthyPods.status).toBe('ok');
  });
});

describe('runIncidentSnapshot — events grouping', () => {
  it('groups events by reason and counts occurrences', async () => {
    const now = new Date();
    const client = makeClient({
      events: [
        {
          reason: 'BackOff',
          type: 'Warning',
          count: 5,
          message: 'Back-off restarting failed container',
          involvedObject: { kind: 'Pod', name: 'a', namespace: 'payments' },
          lastTimestamp: now.toISOString(),
        },
        {
          reason: 'BackOff',
          type: 'Warning',
          count: 3,
          message: 'Back-off restarting failed container',
          involvedObject: { kind: 'Pod', name: 'b', namespace: 'payments' },
          lastTimestamp: now.toISOString(),
        },
        {
          reason: 'FailedScheduling',
          type: 'Warning',
          count: 2,
          message: 'no nodes available',
          involvedObject: { kind: 'Pod', name: 'c', namespace: 'payments' },
          lastTimestamp: now.toISOString(),
        },
      ],
    });
    const snap = await runIncidentSnapshot(client, {});
    const ev = snap.recentEvents.data!;
    expect(ev.totalWarnings).toBe(10);
    expect(ev.topReasons[0].reason).toBe('BackOff');
    expect(ev.topReasons[0].count).toBe(8);
  });

  it('drops events outside the time window', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const client = makeClient({
      events: [
        {
          reason: 'OldEvent',
          type: 'Warning',
          count: 1,
          message: 'irrelevant',
          involvedObject: { kind: 'Pod', name: 'old' },
          lastTimestamp: old,
        },
      ],
    });
    const snap = await runIncidentSnapshot(client, { since: '5m' });
    expect(snap.recentEvents.data!.totalWarnings).toBe(0);
  });
});

describe('runIncidentSnapshot — rollouts', () => {
  it('classifies stuck vs in-progress', async () => {
    const longAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    const client = makeClient({
      deployments: [
        {
          metadata: { name: 'stuck', namespace: 'payments' },
          spec: { replicas: 8 },
          status: {
            readyReplicas: 5,
            conditions: [
              {
                type: 'Progressing',
                status: 'False',
                lastUpdateTime: longAgo,
              },
            ],
          },
        },
        {
          metadata: {
            name: 'rolling',
            namespace: 'payments',
            creationTimestamp: recent,
          },
          spec: { replicas: 3 },
          status: {
            readyReplicas: 1,
            conditions: [
              { type: 'Progressing', status: 'True', lastUpdateTime: recent },
            ],
          },
        },
      ],
    });
    const snap = await runIncidentSnapshot(client, {});
    const ro = snap.activeRollouts.data!;
    expect(ro.stuck.length).toBe(1);
    expect(ro.stuck[0].name).toBe('stuck');
    expect(ro.inProgress.length).toBe(1);
    expect(ro.inProgress[0].name).toBe('rolling');
  });
});

describe('runIncidentSnapshot — node pressure', () => {
  it('separates unreachable from pressured', async () => {
    const client = makeClient({
      nodes: [
        {
          metadata: { name: 'down' },
          status: {
            conditions: [{ type: 'Ready', status: 'Unknown' }],
          },
        },
        {
          metadata: { name: 'mempressure' },
          status: {
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'MemoryPressure', status: 'True' },
            ],
          },
        },
        {
          metadata: { name: 'healthy' },
          status: {
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'MemoryPressure', status: 'False' },
            ],
          },
        },
      ],
    });
    const snap = await runIncidentSnapshot(client, {});
    const np = snap.nodePressure.data!;
    expect(np.unreachableNodes).toContain('down');
    expect(np.nodesWithPressure[0].name).toBe('mempressure');
    expect(np.nodesWithPressure[0].conditions).toContain('MemoryPressure');
  });
});

describe('runIncidentSnapshot — control plane', () => {
  it('flags webhooks pointing at missing services with failurePolicy=Fail', async () => {
    const client = makeClient({
      validatingWebhooks: [
        {
          metadata: { name: 'policy.example' },
          webhooks: [
            {
              name: 'v1.example',
              failurePolicy: 'Fail',
              clientConfig: {
                service: { name: 'gone', namespace: 'kube-system' },
              },
            },
          ],
        },
      ],
      services: { 'kube-system/gone': false },
    });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.controlPlane.status).toBe('degraded');
    expect(snap.controlPlane.data!.failingWebhooks.length).toBe(1);
    expect(snap.controlPlane.data!.failingWebhooks[0].name).toContain(
      'policy.example',
    );
  });

  it('skips control-plane checks for namespaced scope by default', async () => {
    const client = makeClient({});
    const snap = await runIncidentSnapshot(client, { namespace: 'payments' });
    expect(snap.controlPlane.reason).toBe('skipped (namespaced scope)');
  });
});

describe('runIncidentSnapshot — summary severity', () => {
  it('green when nothing is wrong', async () => {
    const snap = await runIncidentSnapshot(makeClient({}), {});
    expect(snap.summary.severity).toBe('green');
  });

  it('red when nodes are unreachable', async () => {
    const client = makeClient({
      nodes: [
        {
          metadata: { name: 'down' },
          status: { conditions: [{ type: 'Ready', status: 'Unknown' }] },
        },
      ],
    });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.summary.severity).toBe('red');
    expect(snap.summary.headline).toContain('unreachable');
  });

  it('yellow when a few unhealthy pods but no node/rollout issues', async () => {
    const client = makeClient({ pods: [crashloopPod, imagePullPod] });
    const snap = await runIncidentSnapshot(client, {});
    expect(snap.summary.severity).toBe('yellow');
  });
});
