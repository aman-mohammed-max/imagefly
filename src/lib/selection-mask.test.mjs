import test from "node:test";
import assert from "node:assert/strict";
import {
  canvasToImagePoint,
  imageToCanvasPoint,
  normalizedIrisPolygons,
  rasterizeSelectionMask,
  screenBrushToImageSize,
} from "./selection-mask.mjs";

test("canvas/image mapping preserves image coordinates across zoom and canvas offsets", () => {
  const view = { scale: 0.25, offsetX: 20, offsetY: 10 };
  const source = canvasToImagePoint({ x: 120, y: 70 }, view);
  assert.deepEqual(source, { x: 400, y: 240 });
  assert.deepEqual(imageToCanvasPoint(source, view), { x: 120, y: 70 });
  assert.equal(screenBrushToImageSize(8, view.scale), 32);
  assert.throws(() => canvasToImagePoint({ x: 1, y: 1 }, { scale: 0 }), /positive/);
});

test("brush rasterization makes a bounded, antialiased round mask in source pixels", () => {
  const alpha = rasterizeSelectionMask(40, 40, [{ points: [20.1, 20.1], size: 12 }]);
  assert.equal(alpha[20 * 40 + 20], 255);
  assert.ok(alpha[20 * 40 + 26] > 0 && alpha[20 * 40 + 26] < 255);
  assert.equal(alpha[20 * 40 + 28], 0);
  assert.equal(alpha[5 * 40 + 5], 0);
});

test("line strokes and polygons rasterize at full image-space coordinates", () => {
  const line = rasterizeSelectionMask(40, 40, [{ points: [5, 10, 30, 10], size: 4 }]);
  assert.equal(line[10 * 40 + 20], 255);
  assert.equal(line[16 * 40 + 20], 0);
  const polygon = rasterizeSelectionMask(40, 40, [], [
    { x: 8.1, y: 8.1 }, { x: 20.1, y: 8.1 }, { x: 20.1, y: 20.1 }, { x: 8.1, y: 20.1 },
  ]);
  assert.ok(polygon[12 * 40 + 12] > 240);
  assert.equal(polygon[24 * 40 + 24], 0);
});

test("MediaPipe normalized iris points are converted to full-resolution image pixels", () => {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  landmarks[469] = { x: 0.25, y: 0.3 };
  landmarks[470] = { x: 0.3, y: 0.25 };
  landmarks[471] = { x: 0.35, y: 0.3 };
  landmarks[472] = { x: 0.3, y: 0.35 };
  landmarks[474] = { x: 0.65, y: 0.3 };
  landmarks[475] = { x: 0.7, y: 0.25 };
  landmarks[476] = { x: 0.75, y: 0.3 };
  landmarks[477] = { x: 0.7, y: 0.35 };
  assert.deepEqual(normalizedIrisPolygons(landmarks, 1600, 1000)[0][0], { x: 400, y: 300 });
  assert.deepEqual(normalizedIrisPolygons(landmarks, 1600, 1000)[1][2], { x: 1200, y: 300 });
});
