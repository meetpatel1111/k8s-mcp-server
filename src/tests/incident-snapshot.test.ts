/**
 * Unit tests for k8s_incident_snapshot logic and severity scoring.
 */

import { describe, it, expect } from "@jest/globals";
import {
  parseDurationSeconds,
  ageFrom,
  classifyPodFailure,
  computeSummary,
} from "../k8s-tools/incident-snapshot.js";
import * as k8s from "@kubernetes/client-node";

describe("parseDurationSeconds", () => {
  it("parses seconds, minutes, hours, days", () => {
    expect(parseDurationSeconds("30s")).toBe(30);
    expect(parseDurationSeconds("5m")).toBe(300);
    expect(parseDurationSeconds("1h")).toBe(3600);
    expect(parseDurationSeconds("2d")).toBe(172800);
  });

  it("falls back to 15m for invalid input", () => {
    expect(parseDurationSeconds("nope")).toBe(900);
    expect(parseDurationSeconds("")).toBe(900);
  });
});

describe("ageFrom", () => {
  it("formats ages correctly", () => {
    const now = Date.now();
    expect(ageFrom(new Date(now - 30 * 1000))).toBe("30s");
    expect(ageFrom(new Date(now - 5 * 60 * 1000))).toBe("5m");
    expect(ageFrom(new Date(now - (2 * 3600 + 10 * 60) * 1000))).toBe("2h10m");
    expect(ageFrom(new Date(now - (3 * 86400 + 5 * 3600) * 1000))).toBe("3d5h");
  });

  it("handles undefined", () => {
    expect(ageFrom(undefined)).toBe("unknown");
  });
});

describe("classifyPodFailure", () => {
  it("identifies CrashLoopBackOff", () => {
    const pod: k8s.V1Pod = {
      status: {
        phase: "Running",
        containerStatuses: [
          {
            name: "app",
            image: "app:latest",
            imageID: "docker://123",
            ready: false,
            restartCount: 5,
            state: { waiting: { reason: "CrashLoopBackOff", message: "backoff" } },
          } as any,
        ],
      },
    };
    const res = classifyPodFailure(pod);
    expect(res).not.toBeNull();
    expect(res!.mode).toBe("CrashLoopBackOff");
    expect(res!.restartCount).toBe(5);
  });

  it("identifies OOMKilled", () => {
    const pod: k8s.V1Pod = {
      status: {
        phase: "Running",
        containerStatuses: [
          {
            name: "app",
            image: "app:latest",
            imageID: "docker://123",
            ready: false,
            restartCount: 1,
            lastState: { terminated: { reason: "OOMKilled", exitCode: 137 } },
            state: { waiting: { reason: "CrashLoopBackOff" } },
          } as any,
        ],
      },
    };
    const res = classifyPodFailure(pod);
    expect(res).not.toBeNull();
    expect(res!.mode).toBe("OOMKilled");
  });

  it("identifies ImagePullBackOff", () => {
    const pod: k8s.V1Pod = {
      status: {
        phase: "Pending",
        containerStatuses: [
          {
            name: "app",
            image: "app:latest",
            imageID: "docker://123",
            ready: false,
            restartCount: 0,
            state: { waiting: { reason: "ImagePullBackOff" } },
          } as any,
        ],
      },
    };
    const res = classifyPodFailure(pod);
    expect(res!.mode).toBe("ImagePullBackOff");
  });

  it("identifies Evicted pods", () => {
    const pod: k8s.V1Pod = {
      status: {
        phase: "Failed",
        reason: "Evicted",
      },
    };
    const res = classifyPodFailure(pod);
    expect(res!.mode).toBe("Evicted");
  });

  it("returns null for healthy running pods", () => {
    const pod: k8s.V1Pod = {
      status: {
        phase: "Running",
        containerStatuses: [{ name: "app", image: "app", imageID: "123", ready: true, restartCount: 0, state: { running: {} } } as any],
      },
    };
    expect(classifyPodFailure(pod)).toBeNull();
  });
});

describe("computeSummary", () => {
  const baseSnap: any = {
    unhealthyPods: { status: "ok", data: { totalUnhealthy: 0, byFailureMode: {} } },
    recentEvents: { status: "ok", data: { totalWarnings: 0, topReasons: [] } },
    activeRollouts: { status: "ok", data: { stuck: [], inProgress: [] } },
    nodePressure: { status: "ok", data: { nodesWithPressure: [], unreachableNodes: [] } },
    controlPlane: { status: "ok", data: { failingWebhooks: [], unavailableApiServices: [] } },
  };

  it("returns green for healthy cluster", () => {
    const sum = computeSummary(baseSnap);
    expect(sum.severity).toBe("green");
    expect(sum.headline).toBe("No incident-level issues detected.");
  });

  it("returns yellow for few unhealthy pods", () => {
    const snap = {
      ...baseSnap,
      unhealthyPods: {
        status: "ok",
        data: { totalUnhealthy: 2, byFailureMode: { CrashLoopBackOff: { count: 2, examples: [] } } },
      },
    };
    const sum = computeSummary(snap);
    expect(sum.severity).toBe("yellow");
    expect(sum.flags[0]).toContain("2 unhealthy pods");
  });

  it("returns red for many unhealthy pods", () => {
    const snap = {
      ...baseSnap,
      unhealthyPods: {
        status: "ok",
        data: { totalUnhealthy: 10, byFailureMode: { OOMKilled: { count: 10, examples: [] } } },
      },
    };
    const sum = computeSummary(snap);
    expect(sum.severity).toBe("red");
  });

  it("returns red for stuck rollouts", () => {
    const snap = {
      ...baseSnap,
      activeRollouts: {
        status: "ok",
        data: { stuck: [{ name: "app" }], inProgress: [] },
      },
    };
    const sum = computeSummary(snap);
    expect(sum.severity).toBe("red");
    expect(sum.flags[0]).toBe("1 stuck rollout(s)");
  });

  it("returns red for node pressure", () => {
    const snap = {
      ...baseSnap,
      nodePressure: {
        status: "ok",
        data: { nodesWithPressure: [{ name: "node1" }], unreachableNodes: [] },
      },
    };
    const sum = computeSummary(snap);
    expect(sum.severity).toBe("red");
  });

  it("returns red for control plane issues", () => {
    const snap = {
      ...baseSnap,
      controlPlane: {
        status: "ok",
        data: { failingWebhooks: [{ name: "wh" }], unavailableApiServices: [] },
      },
    };
    const sum = computeSummary(snap);
    expect(sum.severity).toBe("red");
  });
});
