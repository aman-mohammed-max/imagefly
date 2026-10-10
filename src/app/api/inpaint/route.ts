import { NextResponse } from "next/server";
import sharp from "sharp";
import { compositeSelection, createProviderMask } from "@/lib/composite";
import { getImageProvider } from "@/lib/image-provider";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const imageFile = form.get("image");
    const maskFile = form.get("mask");
    const mode = form.get("mode");
    const overlayFile = form.get("overlay");
    const promptValue = form.get("prompt");
    if (!(imageFile instanceof File) || !(maskFile instanceof File) || typeof promptValue !== "string") {
      return NextResponse.json({ error: "Add an image, a selection mask, and an editing instruction." }, { status: 400 });
    }
    if (imageFile.size > MAX_UPLOAD_BYTES || maskFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Image or mask is too large. Try an image under 18 MB." }, { status: 413 });
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(imageFile.type) || maskFile.type !== "image/png") {
      return NextResponse.json({ error: "Use a supported image and a PNG selection mask." }, { status: 415 });
    }

    const uploaded = Buffer.from(await imageFile.arrayBuffer());
    const selection = Buffer.from(await maskFile.arrayBuffer());
    const uploadedMetadata = await sharp(uploaded).metadata();
    if (!uploadedMetadata.width || !uploadedMetadata.height || uploadedMetadata.width * uploadedMetadata.height > MAX_PIXELS) {
      return NextResponse.json({ error: "This image is too large to edit. Use an image under 20 megapixels." }, { status: 413 });
    }
    // Bake EXIF rotation before aligning pixels with the browser-created selection mask.
    const original = await sharp(uploaded).rotate().png().toBuffer();
    const metadata = await sharp(original).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({ error: "Could not read image dimensions." }, { status: 400 });
    const sourceScale = Math.min(1, 1536 / Math.max(metadata.width, metadata.height));
    const sourceWidth = Math.max(1, Math.round(metadata.width * sourceScale));
    const sourceHeight = Math.max(1, Math.round(metadata.height * sourceScale));
    // GPT Image requires at least 655,360 input pixels. Upscale smaller working copies to meet it.
    const minimumScale = Math.sqrt(655_360 / (sourceWidth * sourceHeight));
    const scale = Math.max(1, minimumScale);
    const editWidth = Math.max(1, Math.round(sourceWidth * scale));
    const editHeight = Math.max(1, Math.round(sourceHeight * scale));
    if (Math.max(editWidth, editHeight) > 2560) {
      return NextResponse.json({ error: "This image has an unusually narrow aspect ratio and cannot be sent at a supported working size." }, { status: 400 });
    }
    const providerImage = await sharp(original).resize(editWidth, editHeight, { fit: "fill" }).png().toBuffer();
    const providerMask = await createProviderMask(selection, editWidth, editHeight);
    const instruction = promptValue.trim().slice(0, 1000);
    const prompt = instruction || "Remove the selected object and naturally reconstruct the background. Leave everything outside the transparent mask unchanged.";
    const generated = await getImageProvider().inpaint({ image: providerImage, mask: providerMask, prompt, mimeType: "image/png" });
    const result = await compositeSelection(original, generated, selection);
    let finalImage = result.image;
    let preservationPercent = result.preservationPercent;
    if (mode === "move") {
      if (!(overlayFile instanceof File) || overlayFile.type !== "image/png" || overlayFile.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "The selected object layer is missing or too large." }, { status: 400 });
      }
      const left = Math.round(Number(form.get("x")));
      const top = Math.round(Number(form.get("y")));
      const width = Math.round(Number(form.get("width")));
      const height = Math.round(Number(form.get("height")));
      if (![left, top, width, height].every(Number.isFinite) || width < 1 || height < 1 || left < 0 || top < 0 || left + width > metadata.width || top + height > metadata.height) {
        return NextResponse.json({ error: "The moved object must stay inside the image." }, { status: 400 });
      }
      const overlay = Buffer.from(await overlayFile.arrayBuffer());
      const transformedOverlay = await sharp(overlay).resize(width, height).png().toBuffer();
      const placed = await sharp(result.image).composite([{ input: transformedOverlay, left, top }]).png().toBuffer();
      const { data: selectedPixels } = await sharp(selection).resize(metadata.width, metadata.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data: outputPixels } = await sharp(placed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data: sourcePixels } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data: movedAlpha } = await sharp(transformedOverlay).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      let unchanged = 0;
      let total = 0;
      for (let y = 0; y < metadata.height; y += 1) {
        for (let x = 0; x < metadata.width; x += 1) {
          const pixel = y * metadata.width + x;
          const inSource = selectedPixels[pixel * 4 + 3] > 0;
          const inDestination = x >= left && x < left + width && y >= top && y < top + height && movedAlpha[(y - top) * width + x - left] > 0;
          if (!inSource && !inDestination) {
            total += 1;
            const offset = pixel * 4;
            if (sourcePixels[offset] === outputPixels[offset] && sourcePixels[offset + 1] === outputPixels[offset + 1] && sourcePixels[offset + 2] === outputPixels[offset + 2]) unchanged += 1;
          }
        }
      }
      preservationPercent = total === 0 ? 100 : (unchanged / total) * 100;
      finalImage = placed;
    }
    return NextResponse.json({
      image: `data:image/png;base64,${finalImage.toString("base64")}`,
      preservationPercent: Number(preservationPercent.toFixed(2)),
      dimensions: { width: metadata.width, height: metadata.height },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image editing failed. Please try again.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
