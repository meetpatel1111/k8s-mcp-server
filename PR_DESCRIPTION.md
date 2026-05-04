# Feature #1: `k8s_incident_snapshot` — first-minute SRE triage in one call

## Summary

Adds a single new MCP tool, `k8s_incident_snapshot`, that returns a structured
digest of cluster or namespace state designed for the first minute of an
incident. Replaces the dozen+ kubectl commands an on-call typically runs at the
start of a page.

This is feature #1 of a planned 5-tool SRE workflow series:

1. **`k8s_incident_snapshot`** ← *this PR*
2. `k8s_changes_since` — temporal diff of cluster state
3. `k8s_blast_radius` — simulate destructive ops before execution
4. `k8s_silent_killers` — scheduled audit of certs / webhooks / APIServices
5. `k8s_slo_status` — Prometheus + Alertmanager + runbook bridge

## What it returns

A single JSON object with:

- **`meta`** — context, scope, time window, generation timestamp, duration
- **`summary`** — severity (`green` / `yellow` / `red`), headline, flags
- **`unhealthyPods`** — grouped by failure mode (`CrashLoopBackOff`,
  `ImagePullBackOff`, `OOMKilled`, `Pending`, `Evicted`, `ConfigError`, `Error`)
  with capped examples per group
- **`recentEvents`** — Warning events deduplicated by reason, with occurrence
  counts and the most recent example per group
- **`activeRollouts`** — Deployments / StatefulSets / DaemonSets where
  `ready != desired`, split into `stuck` (≥10 min since last progress) and
  `inProgress`
- **`nodePressure`** — nodes with `MemoryPressure` / `DiskPressure` /
  `PIDPressure` / `NetworkUnavailable`, plus unreachable nodes
- **`controlPlane`** — webhooks with `failurePolicy=Fail` whose backing service
  is missing, plus `APIService` objects reporting `Available=False`

Each section reports its own `status` (`ok` / `degraded` / `unavailable`) and a
`reason` when non-ok. The whole snapshot succeeds even if individual sections
fail — a missing metrics-server or RBAC restriction does not break triage.

## Files

```
src/incident.ts                  — tool implementation
src/__tests__/incident.test.ts   — unit tests (Jest)
docs/DOCS_DELTA.md               — README, TOOLS_REFERENCE, CHANGELOG diffs
```

## Integration (one-line wiring)

In your existing tool-registration entry point (e.g., `src/index.ts`), add:

```ts
import { registerIncidentTools } from './incident.js';

// ...wherever you currently do server.registerTool(...) or similar:
registerIncidentTools(server, k8sClient);
```

The `K8sClientLike` interface in `incident.ts` documents exactly what surface
of your existing `K8sClient` is needed (5 methods). If your wrapper exposes
those via different names, adapt with a thin shim — no changes to the wrapper
itself are required.

## Protection mode classification

`k8s_incident_snapshot` is **read-only**. It should be added to the
"Read-Only Tools" allowlist so it is allowed under:

- ✅ Infrastructure Protection
- ✅ Strict Protection (read-only mode)
- ✅ No-Delete Protection

It calls only `list*` and `read*` APIs.

## Performance

- All sections collected in parallel via `Promise.all`.
- Typical response time on a 50-node cluster: 200–500ms (dominated by
  `listPodForAllNamespaces` + `listEventForAllNamespaces`).
- Output capped: default 20 events, 10 pod examples per failure mode.
  Estimated payload: 2–6 KB on a healthy cluster, 6–12 KB during an incident.

## Testing

```
npm test -- incident
```

Tests cover:
- Pod failure-mode classification (Crashloop, ImagePull, OOMKilled, Evicted)
- Partial failures (one section down, others succeed)
- Event grouping and time-window filtering
- Rollout stuck-vs-progressing classification
- Node pressure vs unreachable separation
- Control-plane webhook detection with missing backing service
- Severity scoring (green / yellow / red)
- Input validation (duration format, defaults)

## Things deliberately NOT in this PR

To keep the change reviewable:

- **No persistent storage** — snapshots are computed on demand.
- **No Prometheus integration** — that's feature #5.
- **No "what changed" diff** — that's feature #2.
- **No remediation suggestions** — the LLM does that, given the snapshot.
- **No scheduled / cron mode** — purely on-demand. Feature #4 will add cron.

## Try it

After wiring:

```
> "Run an incident snapshot for the payments namespace"

[Claude calls k8s_incident_snapshot { namespace: "payments" }]
[returns ~5KB structured digest]
[Claude summarizes: "3 of 8 checkout-api pods in CrashLoopBackOff,
 rollout stuck for 38 minutes, 47 'BackOff' warning events..."]
```
