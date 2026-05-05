/**
 * Unit tests for k8s_blast_radius pure helpers.
 *
 * The async analyzers (analyzeDrain/Cordon/Delete/Scale) are exercised
 * through the MCP smoke test rather than mocked here. These tests cover
 * the deterministic decision logic that drives the verdicts.
 */

import { describe, it, expect } from "@jest/globals";
import {
  escalateVerdict,
  topController,
  selectorMatches,
  analyzeScaleParams,
  analyzeCordonCapacity,
  analyzeDrainPods,
  PdbView,
} from "../k8s-tools/blast-radius.js";

describe("escalateVerdict", () => {
  it("safe + safe = safe", () => {
    expect(escalateVerdict("safe", "safe")).toBe("safe");
  });
  it("safe + risky = risky", () => {
    expect(escalateVerdict("safe", "risky")).toBe("risky");
  });
  it("risky + safe = risky", () => {
    expect(escalateVerdict("risky", "safe")).toBe("risky");
  });
  it("risky + risky = risky", () => {
    expect(escalateVerdict("risky", "risky")).toBe("risky");
  });
  it("safe + unsafe = unsafe", () => {
    expect(escalateVerdict("safe", "unsafe")).toBe("unsafe");
  });
  it("unsafe + risky = unsafe", () => {
    expect(escalateVerdict("unsafe", "risky")).toBe("unsafe");
  });
  it("unsafe + unsafe = unsafe", () => {
    expect(escalateVerdict("unsafe", "unsafe")).toBe("unsafe");
  });
});

describe("topController", () => {
  it("returns null for empty/undefined owner refs", () => {
    expect(topController(undefined)).toBeNull();
    expect(topController([])).toBeNull();
  });
  it("returns the controller=true entry when present", () => {
    const owners = [
      { kind: "ReplicaSet", name: "rs1", controller: false },
      { kind: "ReplicaSet", name: "rs2", controller: true },
    ];
    expect(topController(owners)).toEqual({
      kind: "ReplicaSet",
      name: "rs2",
      uid: undefined,
    });
  });
  it("falls back to first entry when no controller flag", () => {
    const owners = [{ kind: "ReplicaSet", name: "rs1" }];
    expect(topController(owners)?.name).toBe("rs1");
  });
  it("preserves uid when present", () => {
    const owners = [{ kind: "ReplicaSet", name: "rs1", uid: "abc-123", controller: true }];
    expect(topController(owners)?.uid).toBe("abc-123");
  });
});

describe("selectorMatches", () => {
  it("returns false for undefined selector", () => {
    expect(selectorMatches({ app: "web" }, undefined)).toBe(false);
  });
  it("returns false for empty selector", () => {
    expect(selectorMatches({ app: "web" }, {})).toBe(false);
  });
  it("returns false for undefined labels", () => {
    expect(selectorMatches(undefined, { app: "web" })).toBe(false);
  });
  it("returns true when all selector keys match labels", () => {
    expect(
      selectorMatches({ app: "web", tier: "frontend" }, { app: "web" }),
    ).toBe(true);
  });
  it("returns false when any selector key doesn't match", () => {
    expect(
      selectorMatches({ app: "web" }, { app: "web", tier: "backend" }),
    ).toBe(false);
  });
  it("requires exact value match", () => {
    expect(selectorMatches({ app: "web" }, { app: "web2" })).toBe(false);
  });
});

describe("analyzeScaleParams", () => {
  const labels = { app: "web" };

  it("no-op when target equals current", () => {
    const r = analyzeScaleParams(3, 3, labels, []);
    expect(r.verdict).toBe("safe");
    expect(r.reasons[0]).toMatch(/no-op/i);
  });

  it("flags scale-to-zero as unsafe", () => {
    const r = analyzeScaleParams(3, 0, labels, []);
    expect(r.verdict).toBe("unsafe");
    expect(r.reasons.some((x) => /unavailable/i.test(x))).toBe(true);
  });

  it("scale-down without PDB is risky", () => {
    const r = analyzeScaleParams(5, 3, labels, []);
    expect(r.verdict).toBe("risky");
    expect(r.reasons[0]).toMatch(/Scaling down from 5 to 3/);
  });

  it("scale-down violating PDB minAvailable is unsafe", () => {
    const pdbs: PdbView[] = [
      { name: "web-pdb", minAvailable: 4, selector: { app: "web" } },
    ];
    const r = analyzeScaleParams(5, 2, labels, pdbs);
    expect(r.verdict).toBe("unsafe");
    expect(r.reasons.some((x) => /minAvailable=4/.test(x))).toBe(true);
  });

  it("scale-down at PDB minAvailable boundary is risky (not unsafe)", () => {
    const pdbs: PdbView[] = [
      { name: "web-pdb", minAvailable: 3, selector: { app: "web" } },
    ];
    const r = analyzeScaleParams(5, 3, labels, pdbs);
    expect(r.verdict).toBe("risky");
  });

  it("ignores PDBs whose selector doesn't match", () => {
    const pdbs: PdbView[] = [
      { name: "other-pdb", minAvailable: 99, selector: { app: "other" } },
    ];
    const r = analyzeScaleParams(5, 3, labels, pdbs);
    expect(r.verdict).toBe("risky"); // not escalated to unsafe
  });

  it("ignores percentage-style minAvailable (not numeric)", () => {
    const pdbs: PdbView[] = [
      { name: "web-pdb", minAvailable: "50%", selector: { app: "web" } },
    ];
    const r = analyzeScaleParams(5, 3, labels, pdbs);
    expect(r.verdict).toBe("risky"); // can't enforce non-numeric, stays risky
  });

  it("scale-up reports safe with capacity-check note", () => {
    const r = analyzeScaleParams(3, 5, labels, []);
    expect(r.verdict).toBe("safe");
    expect(r.reasons[0]).toMatch(/Scaling up from 3 to 5/);
  });
});

describe("analyzeCordonCapacity", () => {
  it("safe when many schedulable nodes remain", () => {
    const r = analyzeCordonCapacity(10, 5);
    expect(r.verdict).toBe("safe");
  });

  it("risky when only 2 schedulable nodes remain", () => {
    const r = analyzeCordonCapacity(3, 5);
    expect(r.verdict).toBe("risky");
  });

  it("risky when only 1 schedulable node remains", () => {
    const r = analyzeCordonCapacity(2, 5);
    expect(r.verdict).toBe("risky");
  });

  it("unsafe when 0 schedulable nodes remain after cordon", () => {
    const r = analyzeCordonCapacity(1, 5);
    expect(r.verdict).toBe("unsafe");
  });

  it("reports existing pod count in reasons", () => {
    const r = analyzeCordonCapacity(5, 7);
    expect(r.reasons.some((x) => /7 existing pods/.test(x))).toBe(true);
  });
});

describe("analyzeDrainPods", () => {
  it("safe when no pods on node", () => {
    const r = analyzeDrainPods(0, [], [], []);
    expect(r.verdict).toBe("safe");
    expect(r.reasons[0]).toMatch(/no impact/i);
  });

  it("risky when ordinary pods would be evicted", () => {
    const r = analyzeDrainPods(3, [], [], []);
    expect(r.verdict).toBe("risky");
  });

  it("unsafe when orphan pods present", () => {
    const r = analyzeDrainPods(2, [], [], ["default/orphan"]);
    expect(r.verdict).toBe("unsafe");
    expect(r.reasons.some((x) => /orphan/i.test(x))).toBe(true);
  });

  it("risky (not unsafe) when only stateful pods present", () => {
    const r = analyzeDrainPods(1, [], ["data/db-0"], []);
    expect(r.verdict).toBe("risky");
    expect(r.reasons.some((x) => /StatefulSet/i.test(x))).toBe(true);
  });

  it("unsafe when last replica detected", () => {
    const r = analyzeDrainPods(1, ["Deployment/web"], [], []);
    expect(r.verdict).toBe("unsafe");
    expect(r.reasons.some((x) => /last running replica/i.test(x))).toBe(true);
  });

  it("unsafe (escalates) when both stateful and last-replica concerns", () => {
    const r = analyzeDrainPods(2, ["StatefulSet/db"], ["data/db-0"], []);
    expect(r.verdict).toBe("unsafe");
  });
});
