# Feature #1 — `k8s_incident_snapshot`

## Add to `TOOLS_REFERENCE.md`

In the **Monitoring & Observability** table, add this row:

| Tool | Description | Key Parameters |
| --- | --- | --- |
| `k8s_incident_snapshot` | First-minute SRE triage in one call. Returns unhealthy pods grouped by failure mode, recent warning events, active and stuck rollouts, node pressure, and control-plane health (webhooks + APIServices). | `namespace?`, `since?` (default `15m`), `includeControlPlane?: boolean`, `maxEvents?: number` (default 20), `maxPodsPerCategory?: number` (default 10) |

In the **Natural Language to Tool Mapping → Resource Status & Health** section, add:

| User Query Pattern | Tool | Key Parameters |
| --- | --- | --- |
| "What's wrong with my cluster?" / "Run an incident snapshot" | `k8s_incident_snapshot` | `since?`, `namespace?` |
| "What's wrong with the payments namespace?" | `k8s_incident_snapshot` | `namespace="payments"` |

In the **Protection Mode Classifications → Read-Only Tools** section, add `k8s_incident_snapshot` to the list (it is read-only and safe under all three protection modes).

## Add to `README.md`

Under the existing **Workflow 3: Debug a Failing Pod** example, add a new workflow:

### Workflow 9: First-minute incident triage (NEW in v0.23.0)

**Goal:** Quickly understand what's wrong when a service is paging.

**Steps:**

1. Ask Claude: "Run an incident snapshot for the payments namespace"
2. Claude calls `k8s_incident_snapshot` with `namespace="payments"` and returns:
   - Unhealthy pods grouped by failure mode (CrashLoopBackOff, ImagePullBackOff, OOMKilled, etc.)
   - Top warning event reasons in the last 15 minutes, with occurrence counts
   - Active rollouts with stuck-vs-in-progress classification
   - Node pressure conditions
   - A severity summary (green/yellow/red) and headline

**Expected result:** A coherent picture of cluster state in a single call, replacing the dozen+ kubectl commands you'd normally run during the first minute of a page.

## Add to `CHANGELOG.md`

```
## [0.23.0] - YYYY-MM-DD

### Added
- `k8s_incident_snapshot` — first-minute SRE triage tool. Returns a structured
  digest of cluster or namespace state in one call: unhealthy pods grouped by
  failure mode, deduplicated recent warning events, active and stuck rollouts,
  node pressure conditions, and control-plane health (webhooks + APIServices).
  Each section is collected in parallel and reports its own status, so a single
  failure (e.g., metrics-server unavailable) does not break the snapshot.
  Read-only; safe under all protection modes.
```
