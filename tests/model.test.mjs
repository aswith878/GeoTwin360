import test from "node:test";
import assert from "node:assert/strict";
import { MAIN_NODES, SUB_NODES, fusedRisk, riskBand, snapshotForMinute, vector3d } from "../src/model.mjs";

test("network contains 7 main nodes and 28 sub-nodes", () => {
  assert.equal(MAIN_NODES.length, 7);
  assert.equal(SUB_NODES.length, 28);
});

test("risk fusion uses 75 percent ground and 25 percent satellite", () => {
  assert.equal(fusedRisk(32.9, 42.9), 35.4);
});

test("risk boundaries are classified correctly", () => {
  assert.equal(riskBand(24.9), "normal");
  assert.equal(riskBand(25), "watch");
  assert.equal(riskBand(50), "warning");
  assert.equal(riskBand(75), "critical");
});

test("a minute snapshot is deterministic and bounded", () => {
  const first = snapshotForMinute(123456);
  const second = snapshotForMinute(123456);
  assert.deepEqual(first, second);
  assert.ok(first.fusedRisk >= 0 && first.fusedRisk <= 100);
});

test("3D displacement is Euclidean", () => {
  assert.equal(vector3d(3, 4, 12), 13);
});
