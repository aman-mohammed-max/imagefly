import sharp from "sharp";

export async function compositeSelection(
  original: Buffer,
  generated: Buffer,
  selectionMask: Buffer,
): Promise<{ image: Buffer; preservationPercent: number }> {
  const { data: source, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: generatedPixels } = await sharp(generated)
    .resize(info.width, info.height, { fit: "fill" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: maskPixels } = await sharp(selectionMask)
    .resize(info.width, info.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const output = Buffer.from(source);
  let unchanged = 0;
  let total = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * 4;
    const alpha = maskPixels[offset + 3];
    if (alpha > 0) {
      const blend = alpha / 255;
      for (let channel = 0; channel < 4; channel += 1) {
        output[offset + channel] = Math.round(source[offset + channel] * (1 - blend) + generatedPixels[offset + channel] * blend);
      }
    } else {
      total += 1;
      if (source[offset] === output[offset] && source[offset + 1] === output[offset + 1] && source[offset + 2] === output[offset + 2]) unchanged += 1;
    }
  }

  const image = await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { image, preservationPercent: total === 0 ? 100 : (unchanged / total) * 100 };
}

export async function createProviderMask(selectionMask: Buffer, width: number, height: number) {
  const { data, info } = await sharp(selectionMask).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < info.width * info.height; i += 1) {
    const offset = i * 4;
    // OpenAI edits transparent pixels. The browser mask marks the user's selection opaque.
    const editable = data[offset + 3];
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255 - editable;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
