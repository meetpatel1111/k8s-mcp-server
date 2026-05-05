/**
 * Unit tests for k8s_changes_since helpers and change classification.
 *
 * Tests focus on the deterministic logic — duration parsing, window
 * checks, managedFields walking, and creation/modified/deleting
 * classification — without exercising the Kubernetes API.
 */

import { describe, it, expect } from "@jest/globals";
import {
  parseDurationSeconds,
  ageFrom,
  withinWindow,
  mostRecentManagedField,
  changeFromMeta,
} from "../k8s-tools/changes-since.js";

describe("parseDurationSeconds", () => {
  it("parses seconds, minutes, hours, days", () => {
    expect(parseDurationSeconds("30s")).toBe(30);
    expect(parseDurationSeconds("5m")).toBe(300);
    expect(parseDurationSeconds("1h")).toBe(3600);
    expect(parseDurationSeconds("2d")).toBe(172800);
  });

  it("falls back to 1h for invalid input", () => {
    expect(parseDurationSeconds("nope")).toBe(3600);
    expect(parseDurationSeconds("")).toBe(3600);
  });
});

describe("ageFrom", () => {
  it("formats sub-minute ages in seconds", () => {
    const t = new Date(Date.now() - 30 * 1000);
    expect(ageFrom(t)).toMatch(/^\d+s$/);
  });

  it("formats minute ages", () => {
    const t = new Date(Date.now() - 5 * 60 * 1000);
    expect(ageFrom(t)).toMatch(/^\d+m$/);
  });

  it("formats hour ages with minute remainder", () => {
    const t = new Date(Date.now() - (2 * 3600 + 30 * 60) * 1000);
    expect(ageFrom(t)).toMatch(/^\d+h\d+m$/);
  });

  it("handles undefined", () => {
    expect(ageFrom(undefined)).toBe("unknown");
  });

  it("handles future dates as 0s", () => {
    const future = new Date(Date.now() + 10000);
    expect(ageFrom(future)).toBe("0s");
  });

  it("accepts ISO strings", () => {
    const iso = new Date(Date.now() - 60 * 1000).toISOString();
    expect(ageFrom(iso)).toMatch(/^\d+(s|m)$/);
  });
});

describe("withinWindow", () => {
  it("returns true for timestamps inside the window", () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(withinWindow(recent, 60)).toBe(true);
  });

  it("returns false for timestamps outside the window", () => {
    const old = new Date(Date.now() - 5 * 60 * 1000);
    expect(withinWindow(old, 60)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(withinWindow(undefined, 60)).toBe(false);
  });
});

describe("mostRecentManagedField", () => {
  it("returns the most recent entry when multiple exist", () => {
    const earlier = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const obj = {
      metadata: {
        managedFields: [
          { manager: "argocd", operation: "Apply", time: earlier },
          { manager: "kubectl-edit", operation: "Update", time: later },
        ],
      },
    };
    const result = mostRecentManagedField(obj);
    expect(result).not.toBeNull();
    expect(result!.manager).toBe("kubectl-edit");
    expect(result!.operation).toBe("Update");
  });

  it("returns null when there are no managed fields", () => {
    expect(mostRecentManagedField({ metadata: {} })).toBeNull();
    expect(mostRecentManagedField(undefined)).toBeNull();
  });

  it("skips entries without a time", () => {
    const obj = {
      metadata: {
        managedFields: [
          { manager: "no-time", operation: "Apply" },
          {
            manager: "with-time",
            operation: "Apply",
            time: new Date(Date.now() - 10000).toISOString(),
          },
        ],
      },
    };
    const result = mostRecentManagedField(obj);
    expect(result!.manager).toBe("with-time");
  });

  it("defaults manager and operation when missing on the chosen entry", () => {
    const obj = {
      metadata: {
        managedFields: [{ time: new Date().toISOString() }],
      },
    };
    const result = mostRecentManagedField(obj);
    expect(result!.manager).toBe("unknown");
    expect(result!.operation).toBe("unknown");
  });
});

describe("changeFromMeta", () => {
  const recent = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const old = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  it("classifies recently created resources as 'created'", () => {
    const obj = {
      metadata: {
        name: "new-deploy",
        namespace: "payments",
        creationTimestamp: recent(),
        managedFields: [
          { manager: "argocd", operation: "Apply", time: recent() },
        ],
      },
    };
    const ch = changeFromMeta(obj, "Deployment", 3600, true);
    expect(ch).not.toBeNull();
    expect(ch!.changeType).toBe("created");
    expect(ch!.modifiedBy).toBe("argocd");
    expect(ch!.namespace).toBe("payments");
  });

  it("classifies recently modified resources as 'modified'", () => {
    const obj = {
      metadata: {
        name: "app-config",
        namespace: "payments",
        creationTimestamp: old(),
        managedFields: [
          { manager: "kubectl-edit", operation: "Update", time: recent() },
        ],
      },
    };
    const ch = changeFromMeta(obj, "ConfigMap", 3600, true);
    expect(ch).not.toBeNull();
    expect(ch!.changeType).toBe("modified");
    expect(ch!.modifiedBy).toBe("kubectl-edit");
  });

  it("classifies resources with deletionTimestamp as 'deleting'", () => {
    const obj = {
      metadata: {
        name: "going-away",
        namespace: "default",
        creationTimestamp: old(),
        deletionTimestamp: recent(),
      },
    };
    const ch = changeFromMeta(obj, "Deployment", 3600, true);
    expect(ch).not.toBeNull();
    expect(ch!.changeType).toBe("deleting");
  });

  it("returns null when nothing happened in the window", () => {
    const obj = {
      metadata: {
        name: "stable",
        namespace: "default",
        creationTimestamp: old(),
        managedFields: [{ manager: "argocd", operation: "Apply", time: old() }],
      },
    };
    expect(changeFromMeta(obj, "Deployment", 3600, true)).toBeNull();
  });

  it("returns null for undefined object or missing metadata", () => {
    expect(changeFromMeta(undefined, "Deployment", 3600, true)).toBeNull();
    expect(changeFromMeta({}, "Deployment", 3600, true)).toBeNull();
  });

  it("strips namespace for non-namespaced resources", () => {
    const obj = {
      metadata: {
        name: "cluster-admin-binding",
        namespace: "default",
        creationTimestamp: recent(),
      },
    };
    const ch = changeFromMeta(obj, "ClusterRoleBinding", 3600, false);
    expect(ch!.namespace).toBeNull();
  });

  it("prioritizes deletion over created/modified when both are recent", () => {
    const obj = {
      metadata: {
        name: "deleting-now",
        namespace: "default",
        creationTimestamp: recent(),
        deletionTimestamp: recent(),
        managedFields: [
          { manager: "kubectl", operation: "Update", time: recent() },
        ],
      },
    };
    const ch = changeFromMeta(obj, "Deployment", 3600, true);
    expect(ch!.changeType).toBe("deleting");
  });
});
