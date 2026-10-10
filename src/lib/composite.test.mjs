import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compositeSelection, createProviderMask, featherSelectionMask, measurePreservation } from "./composite.mjs";
import { rasterizeSelectionMask } from "./selection-mask.mjs";

async function pngFromRgb(width, height, color) {
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) data.set(color, i * 3);
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function maskPng(width, height, alpha) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255;
    data[i * 4 + 3] = alpha[i];
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("OpenAI mask polarity is transparent for selected pixels and opaque outside", async () => {
  const imageMask = await maskPng(3, 1, Uint8Array.from([0, 128, 255]));
  const provider = await createProviderMask(imageMask, 3, 1);
  const { data } = await sharp(provider).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([data[3], data[7], data[11]], [255, 127, 0]);
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
});

test("compositor alpha-blends selected pixels and preserves all pixels outside the mask", async () => {
  const original = await pngFromRgb(4, 1, [10, 20, 30]);
  const generated = await pngFromRgb(4, 1, [210, 120, 70]);
  const mask = await maskPng(4, 1, Uint8Array.from([0, 128, 255, 0]));
  const result = await compositeSelection(original, generated, mask, { featherPx: 0 });
  const { data } = await sharp(result.image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)], [10, 20, 30]);
  assert.deepEqual([...data.subarray(3, 6)], [110, 70, 50]);
  assert.deepEqual([...data.subarray(6, 9)], [210, 120, 70]);
  assert.deepEqual([...data.subarray(9, 12)], [10, 20, 30]);
  assert.equal(result.preservationPercent, 100);
});

test("feathering softens only the inside of the selection and leaves exterior alpha zero", async () => {
  const alpha = rasterizeSelectionMask(12, 12, [], [
    { x: 2, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 9 }, { x: 2, y: 9 },
  ]);
  const mask = await maskPng(12, 12, alpha);
  const feathered = await featherSelectionMask(mask, 12, 12, 1.25);
  const { data, info } = await sharp(feathered).raw().toBuffer({ resolveWithObject: true });
  const maskAlpha = (x, y) => data[(y * 12 + x) * info.channels];
  assert.equal(maskAlpha(0, 0), 0);
  assert.equal(maskAlpha(11, 11), 0);
  assert.ok(maskAlpha(5, 2) < alpha[2 * 12 + 5]);
  assert.equal(maskAlpha(5, 5), 255);
});

test("preservation is measured from source and final pixels outside the allowed mask", async () => {
  const original = await pngFromRgb(4, 1, [10, 20, 30]);
  const changed = Buffer.from(await sharp(original).ensureAlpha().raw().toBuffer());
  changed[0] = 99; // one changed unselected pixel
  const edited = await sharp(changed, { raw: { width: 4, height: 1, channels: 4 } }).png().toBuffer();
  const mask = await maskPng(4, 1, Uint8Array.from([0, 0, 255, 0]));
  assert.ok(Math.abs((await measurePreservation(original, edited, mask)) - 200 / 3) < 1e-12);
});
