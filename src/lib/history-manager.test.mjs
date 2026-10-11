import test from "node:test";
import assert from "node:assert/strict";
import {
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  jumpToHistory,
  inferOperationTitle,
  createSelectAllPolygon,
} from "./history-manager.mjs";

test("history manager initializes with initial entry at index 0", () => {
  const history = createHistory({ count: 0 }, "Opened image");
  assert.equal(history.entries.length, 1);
  assert.equal(history.currentIndex, 0);
  assert.equal(history.entries[0].title, "Opened image");
  assert.deepEqual(history.entries[0].state, { count: 0 });
});

test("history push adds entry and updates currentIndex", () => {
  let hist = createHistory({ count: 0 });
  hist = pushHistory(hist, { count: 1 }, "brush-stroke");
  assert.equal(hist.entries.length, 2);
  assert.equal(hist.currentIndex, 1);
  assert.equal(hist.entries[1].title, "Brush Stroke");
  assert.deepEqual(hist.entries[1].state, { count: 1 });
});

test("history undo and redo step correctly", () => {
  let hist = createHistory({ v: "A" });
  hist = pushHistory(hist, { v: "B" }, "brush-stroke");
  hist = pushHistory(hist, { v: "C" }, "polygon-commit");

  assert.equal(hist.currentIndex, 2);

  // Undo 1
  const u1 = undoHistory(hist);
  assert.ok(u1);
  assert.equal(u1.currentIndex, 1);
  assert.equal(u1.entries[u1.currentIndex].state.v, "B");

  // Undo 2
  const u2 = undoHistory(u1);
  assert.ok(u2);
  assert.equal(u2.currentIndex, 0);
  assert.equal(u2.entries[u2.currentIndex].state.v, "A");

  // Undo at start returns null
  assert.equal(undoHistory(u2), null);

  // Redo 1
  const r1 = redoHistory(u2);
  assert.ok(r1);
  assert.equal(r1.currentIndex, 1);
  assert.equal(r1.entries[r1.currentIndex].state.v, "B");

  // Redo 2
  const r2 = redoHistory(r1);
  assert.ok(r2);
  assert.equal(r2.currentIndex, 2);
  assert.equal(r2.entries[r2.currentIndex].state.v, "C");

  // Redo at end returns null
  assert.equal(redoHistory(r2), null);
});

test("pushing new action after undo discards divergent future history", () => {
  let hist = createHistory({ v: 1 });
  hist = pushHistory(hist, { v: 2 }, "brush-stroke");
  hist = pushHistory(hist, { v: 3 }, "brush-stroke");

  // Undo to v: 2
  hist = undoHistory(hist);
  assert.equal(hist.currentIndex, 1);

  // Push new action v: 4
  hist = pushHistory(hist, { v: 4 }, "select-all");
  assert.equal(hist.entries.length, 3);
  assert.equal(hist.currentIndex, 2);
  assert.equal(hist.entries[2].state.v, 4);
  assert.equal(hist.entries[2].title, "Select Entire Image");
  // v: 3 was discarded
  assert.equal(redoHistory(hist), null);
});

test("jumpToHistory navigates directly to target index", () => {
  let hist = createHistory({ s: 0 });
  hist = pushHistory(hist, { s: 1 }, "brush-stroke");
  hist = pushHistory(hist, { s: 2 }, "polygon-commit");
  hist = pushHistory(hist, { s: 3 }, "ai-edit", "Remove the dog");

  const jumped = jumpToHistory(hist, 1);
  assert.ok(jumped);
  assert.equal(jumped.currentIndex, 1);
  assert.equal(jumped.entries[jumped.currentIndex].state.s, 1);

  // Invalid jumps return null
  assert.equal(jumpToHistory(hist, -1), null);
  assert.equal(jumpToHistory(hist, 99), null);
  assert.equal(jumpToHistory(hist, hist.currentIndex), null);
});

test("inferOperationTitle produces descriptive titles for AI operations", () => {
  assert.equal(inferOperationTitle("ai-edit", "Remove the person from the bench"), "Object Removal");
  assert.equal(inferOperationTitle("ai-edit", "Change eye color to emerald green"), "Eye Recoloring");
  assert.equal(inferOperationTitle("ai-edit", "Repair the damaged background wall"), "Background Repair");
  assert.equal(inferOperationTitle("ai-edit", "Add some flowers"), "AI Edit: Add some flowers");
  assert.equal(inferOperationTitle("move-start"), "Lift Selection");
  assert.equal(inferOperationTitle("move-place"), "Place Moved Object");
  assert.equal(inferOperationTitle("invert-selection"), "Invert Selection");
});

test("createSelectAllPolygon returns four corner coordinates", () => {
  const poly = createSelectAllPolygon(800, 600);
  assert.deepEqual(poly, [
    { x: 0, y: 0 },
    { x: 800, y: 0 },
    { x: 800, y: 600 },
    { x: 0, y: 600 },
  ]);
});
