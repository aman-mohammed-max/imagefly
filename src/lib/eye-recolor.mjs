import sharp from "sharp";
import { rasterizeSelectionMask } from "./selection-mask.mjs";
import { featherSelectionMask, measurePreservation } from "./composite.mjs";

const TARGETS = {
  green: { hue: 132, saturation: 0.46 },
  blue: { hue: 215, saturation: 0.5 },
  hazel: { hue: 78, saturation: 0.45 },
  brown: { hue: 32, saturation: 0.46 },
  amber: { hue: 39, saturation: 0.55 },
  gray: { hue: 0, saturation: 0.025 },
};

function toHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  return { hue: (hue + 360) % 360, saturation, lightness };
}

function fromHsl(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let rgb;
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return rgb.map((value) => (value + m) * 255);
}

function toLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel) {
  const value = Math.max(0, Math.min(1, channel));
  return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
}

function luminance(red, green, blue) {
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function recolorPixel(red, green, blue, target) {
  const hsl = toHsl(red, green, blue);
  const saturation = Math.min(0.72, Math.max(target.saturation, hsl.saturation * 0.78));
  const recolored = fromHsl(target.hue, saturation, hsl.lightness);
  const beforeY = luminance(red, green, blue);
  const afterY = luminance(...recolored);
  const gain = afterY > 0 ? Math.min(1.5, beforeY / afterY) : 1;
  return recolored.map((channel) => fromLinear(toLinear(channel) * gain));
}

function validateRegions(regions, width, height) {
  if (!Array.isArray(regions) || regions.length > 10) throw new Error("Could not detect iris boundaries. Try a clear, front-facing portrait.");
  return regions.filter((region) => Array.isArray(region) && region.length >= 4 && region.length <= 16)
    .map((region) => region.map((point) => ({ x: Number(point.x), y: Number(point.y) })))
    .filter((region) => region.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x < width && point.y < height));
}

/**
 * Recolor only face-landmarker iris polygons that overlap the user's brush mask.
 * The user's mask selects eyes; local face landmarks refine those selections to
 * iris boundaries, while pupils and bright catchlights remain source pixels.
 * @param {Buffer} original
 * @param {Buffer} selectionMask
 * @param {keyof typeof TARGETS} color
 * @param {Array<Array<{x:number,y:number}>>} irisRegions source-pixel polygons from MediaPipe
 */
export async function recolorIrises(original, selectionMask, color, irisRegions) {
  const { data: source, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: selectedRgba } = await sharp(selectionMask).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (selectedRgba.length !== info.width * info.height * 4) throw new Error("The eye selection does not match the original image.");
  const selected = new Uint8Array(info.width * info.height);
  for (let pixel = 0; pixel < selected.length; pixel += 1) selected[pixel] = selectedRgba[pixel * 4 + 3];
  const regions = validateRegions(irisRegions, info.width, info.height);
  const target = TARGETS[color];
  const selectedRegions = [];

  for (const polygon of regions) {
    const region = rasterizeSelectionMask(info.width, info.height, [], polygon);
    let regionPixels = 0;
    let overlapPixels = 0;
    for (let pixel = 0; pixel < region.length; pixel += 1) {
      if (region[pixel] > 32) {
        regionPixels += 1;
        if (selected[pixel] > 32) overlapPixels += 1;
      }
    }
    // The selection chooses an eye; the landmark polygon supplies its precise boundary.
    if (regionPixels && overlapPixels / regionPixels >= 0.06) selectedRegions.push(region);
  }

  if (!selectedRegions.length) throw new Error("Select an eye before changing its color. Use the brush over the iris, then retry.");
  const regionAlpha = new Uint8Array(info.width * info.height);
  for (const region of selectedRegions) for (let i = 0; i < regionAlpha.length; i += 1) regionAlpha[i] = Math.max(regionAlpha[i], region[i]);
  const regionMask = Buffer.alloc(regionAlpha.length * 4);
  for (let pixel = 0; pixel < regionAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    regionMask[offset] = regionMask[offset + 1] = regionMask[offset + 2] = 255;
    regionMask[offset + 3] = regionAlpha[pixel];
  }
  const maskPng = await sharp(regionMask, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const feathered = await featherSelectionMask(maskPng, info.width, info.height, 0.85);
  const { data: blendAlpha } = await sharp(feathered).greyscale().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(source);
  const editAlpha = new Uint8Array(regionAlpha.length);
  let changedPixels = 0;

  for (let pixel = 0; pixel < regionAlpha.length; pixel += 1) {
    const amount = (blendAlpha[pixel] / 255) * 0.76;
    if (amount < 0.015) continue;
    const offset = pixel * 4;
    const red = source[offset];
    const green = source[offset + 1];
    const blue = source[offset + 2];
    const luma = luminance(red, green, blue);
    // Dark pupil pixels and specular highlights stay byte-identical.
    if (luma < 0.018 || luma > 0.9) continue;
    const rgb = recolorPixel(red, green, blue, target);
    output[offset] = Math.round(red * (1 - amount) + rgb[0] * amount);
    output[offset + 1] = Math.round(green * (1 - amount) + rgb[1] * amount);
    output[offset + 2] = Math.round(blue * (1 - amount) + rgb[2] * amount);
    editAlpha[pixel] = Math.round(amount * 255);
    changedPixels += 1;
  }

  if (!changedPixels) throw new Error("No visible iris pixels were inside the selected eye. Select more of the iris and retry.");
  const image = await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const editMask = Buffer.alloc(editAlpha.length * 4);
  for (let pixel = 0; pixel < editAlpha.length; pixel += 1) {
    const offset = pixel * 4;
    editMask[offset] = editMask[offset + 1] = editMask[offset + 2] = 255;
    editMask[offset + 3] = editAlpha[pixel];
  }
  const editMaskPng = await sharp(editMask, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const preservationPercent = await measurePreservation(original, image, editMaskPng);
  return {
    image,
    editMask: editMaskPng,
    preservationPercent,
    eyesDetected: selectedRegions.length,
    changedPixels,
  };
}
