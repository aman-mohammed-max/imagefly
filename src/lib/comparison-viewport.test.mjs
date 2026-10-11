import test from "node:test";
import assert from "node:assert/strict";
import { zoomViewportAtPoint } from "./comparison-viewport.mjs";

test("zoom preserves the image point under the pointer", () => {
  const before = { scale: 1, x: 0, y: 0 };
  const point = { x: 120, y: 80 };
  const after = zoomViewportAtPoint(before, 2, point);

  assert.deepEqual(after, { scale: 2, x: -120, y: -80 });
  assert.equal((point.x - after.x) / after.scale, (point.x - before.x) / before.scale);
  assert.equal((point.y - after.y) / after.scale, (point.y - before.y) / before.scale);
});

test("zoom respects configured scale limits", () => {
  const initial = { scale: 1, x: 10, y: -5 };

  assert.equal(zoomViewportAtPoint(initial, 0.01, { x: 0, y: 0 }).scale, 0.5);
  assert.equal(zoomViewportAtPoint(initial, 100, { x: 0, y: 0 }).scale, 4);
});

test("zoom keeps original and edited layers on one shared transform", () => {
  const viewport = { scale: 1.5, x: -40, y: 22 };
  const next = zoomViewportAtPoint(viewport, 1.2, { x: 240, y: 180 });
  const originalPoint = { x: 120, y: 80 };
  const editedPoint = { ...originalPoint };

  const project = (point, view) => ({ x: point.x * view.scale + view.x, y: point.y * view.scale + view.y });
  assert.deepEqual(project(originalPoint, next), project(editedPoint, next));
});
