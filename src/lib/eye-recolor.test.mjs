import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseEyeColorPrompt } from "./eye-prompts.mjs";
import { recolorIrises } from "./eye-recolor.mjs";
import { rasterizeSelectionMask } from "./selection-mask.mjs";

const width = 180;
const height = 90;
const centers = [{ x: 48, y: 45 }, { x: 132, y: 45 }];

function circlePolygon(center, radius, segments = 12) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function maskPng(alpha) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 4;
    rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 255;
    rgba[offset + 3] = alpha[pixel];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function makePortrait() {
  const eyes = centers.map(({ x, y }) => `
    <ellipse cx="${x}" cy="${y}" rx="27" ry="17" fill="#eee9df"/>
    <circle cx="${x}" cy="${y}" r="13" fill="#74889e"/>
    <circle cx="${x}" cy="${y}" r="4.5" fill="#17191b"/>
    <ellipse cx="${x - 3}" cy="${y - 4}" rx="1.8" ry="2.4" fill="#fff"/>
  `).join("");
  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#d19c83"/>${eyes}</svg>`);
  return sharp(svg).png().toBuffer();
}

function pixel(data, point) {
  const offset = (point.y * width + point.x) * 4;
  return [...data.subarray(offset, offset + 3)];
}

function linearLuma([red, green, blue]) {
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

test("eye-color prompt recognition is specific to eye and iris instructions", () => {
  assert.equal(parseEyeColorPrompt("make it green eye"), "green");
  assert.equal(parseEyeColorPrompt("Change both irises to grey"), "gray");
  assert.equal(parseEyeColorPrompt("Make the wall green"), null);
});

test("both selected irises recolor naturally while pupils, catchlights, skin, and outside pixels stay exact", async () => {
  const original = await makePortrait();
  const irisRegions = centers.map((center) => circlePolygon(center, 13));
  const selectionPolygons = centers.map((center) => circlePolygon(center, 26));
  const selectionStrokes = selectionPolygons.map((poly) => ({ points: poly.flatMap((point) => [point.x, point.y]), size: 0 }));
  const selection = await maskPng(rasterizeSelectionMask(width, height, selectionStrokes));
  const result = await recolorIrises(original, selection, "green", irisRegions);
  const { data: before } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: after } = await sharp(result.image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.equal(result.eyesDetected, 2);
  assert.ok(result.changedPixels > 500);
  for (const center of centers) {
    const iris = pixel(after, { x: center.x + 8, y: center.y });
    assert.ok(iris[1] > iris[0] && iris[1] > iris[2], `expected green iris pixel, got ${iris}`);
    assert.deepEqual(pixel(after, center), pixel(before, center), "dark pupil must remain untouched");
    assert.deepEqual(pixel(after, { x: center.x - 3, y: center.y - 4 }), pixel(before, { x: center.x - 3, y: center.y - 4 }), "catchlight must remain untouched");
    const sourceColor = pixel(before, { x: center.x + 8, y: center.y });
    assert.ok(Math.abs(linearLuma(iris) - linearLuma(sourceColor)) < 0.035, "iris luminance should remain close to the source");
  }

  const irisStrokes = irisRegions.map((poly) => ({ points: poly.flatMap((point) => [point.x, point.y]), size: 0 }));
  const region = rasterizeSelectionMask(width, height, irisStrokes);
  for (let index = 0; index < region.length; index += 1) {
    if (region[index] === 0) {
      const offset = index * 4;
      assert.deepEqual([...after.subarray(offset, offset + 3)], [...before.subarray(offset, offset + 3)]);
    }
  }
  assert.equal(result.preservationPercent, 100);
});

test("eye-color editing refuses selections that do not overlap detected iris regions", async () => {
  const original = await makePortrait();
  const selection = await maskPng(rasterizeSelectionMask(width, height, [{ points: [8, 8], size: 6 }]));
  await assert.rejects(recolorIrises(original, selection, "green", centers.map((center) => circlePolygon(center, 13))), /Select an eye/);
});
