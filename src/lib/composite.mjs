import sharp from "sharp";

async function readMaskAlpha(selectionMask, width, height) {
  const { data, info } = await sharp(selectionMask).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) alpha[pixel] = data[pixel * 4 + 3];
  return { alpha, info };
}

/**
 * Feather only the inside edge of a user mask. Clipping the blurred alpha to
 * the original alpha prevents the feather from editing any unselected pixel.
 * @param {Buffer} selectionMask
 * @param {number} width
 * @param {number} height
 * @param {number} featherPx
 */
export async function featherSelectionMask(selectionMask, width, height, featherPx = 1.25) {
  const { alpha } = await readMaskAlpha(selectionMask, width, height);
  if (featherPx <= 0) return sharp(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
  // Use a small separable Gaussian with a predictable radius. Generic image
  // blurs can soften the entire selection on small images.
  const radius = Math.max(1, Math.ceil(featherPx * 2));
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const distance = index - radius;
    return Math.exp(-(distance * distance) / (2 * featherPx * featherPx));
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < weights.length; i += 1) weights[i] /= weightSum;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (alpha[y * width + x] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) return sharp(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
  const roiWidth = right - left + 1;
  const roiHeight = bottom - top + 1;
  // The clipped output only needs blurred values where the source alpha is
  // nonzero. Compute a padded selection ROI instead of blurring the full image.
  const horizontal = new Uint8Array(roiWidth * (roiHeight + radius * 2));
  for (let localY = 0; localY < roiHeight + radius * 2; localY += 1) for (let localX = 0; localX < roiWidth; localX += 1) {
    const y = Math.max(0, Math.min(height - 1, top + localY - radius));
    const x = left + localX;
    let value = 0;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const sampleX = Math.max(0, Math.min(width - 1, x + dx));
      value += alpha[y * width + sampleX] * weights[dx + radius];
    }
    horizontal[localY * roiWidth + localX] = Math.round(value);
  }
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
    let value = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      const localY = y - top + radius + dy;
      value += horizontal[localY * roiWidth + (x - left)] * weights[dy + radius];
    }
    const pixel = y * width + x;
    alpha[pixel] = Math.min(alpha[pixel], Math.round(value));
  }
  return sharp(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/**
 * @param {Buffer} original
 * @param {Buffer} edited
 * @param {Buffer} permittedMask Pixels inside this mask are explicitly editable.
 */
export async function measurePreservation(original, edited, permittedMask) {
  const { data: source, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: output } = await sharp(edited).resize(info.width, info.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { alpha } = await readMaskAlpha(permittedMask, info.width, info.height);
  let unchanged = 0;
  let eligible = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    if (alpha[pixel] > 0) continue;
    eligible += 1;
    const offset = pixel * 4;
    if (source[offset] === output[offset] && source[offset + 1] === output[offset + 1] && source[offset + 2] === output[offset + 2]) unchanged += 1;
  }
  return eligible === 0 ? 100 : (unchanged / eligible) * 100;
}

/** @param {Buffer} original @param {Buffer} generated @param {Buffer} selectionMask @param {{ featherPx?: number }} [options] */
export async function compositeSelection(original, generated, selectionMask, { featherPx = 1.25 } = {}) {
  const { data: source, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: generatedPixels } = await sharp(generated).resize(info.width, info.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const maskBuffer = await featherSelectionMask(selectionMask, info.width, info.height, featherPx);
  const { data: alpha, info: alphaInfo } = await sharp(maskBuffer).raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(source);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const blend = alpha[pixel * alphaInfo.channels] / 255;
    if (blend === 0) continue;
    const offset = pixel * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = Math.round(source[offset + channel] * (1 - blend) + generatedPixels[offset + channel] * blend);
    }
  }
  const image = await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const preservationPercent = await measurePreservation(original, image, selectionMask);
  return { image, preservationPercent };
}

/** Convert an opaque-selected browser alpha mask to OpenAI's transparent-editable convention. */
export async function createProviderMask(selectionMask, width, height) {
  const { alpha } = await readMaskAlpha(selectionMask, width, height);
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = 255 - alpha[pixel];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
