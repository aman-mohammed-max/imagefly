/**
 * Export helpers for saving edited images at full native resolution.
 * Completely isolates output from any canvas UI controls, selection overlays,
 * handles, or comparison sliders.
 */

/**
 * Format export filename with date/time and correct extension.
 * @param {string} [baseName="image-fixer"]
 * @param {"png" | "jpeg"} [format="png"]
 * @returns {string}
 */
export function buildExportFileName(baseName = "image-fixer", format = "png") {
  const ext = format === "jpeg" ? "jpg" : "png";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const cleanBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  return `${cleanBase}-${dateStr}-${timeStr}.${ext}`;
}

/**
 * Verify export mime type from requested format.
 * @param {"png" | "jpeg"} format
 * @returns {string}
 */
export function getMimeType(format) {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

/**
 * Trigger browser file download from Blob or URL.
 * @param {Blob | string} target
 * @param {string} fileName
 */
export function triggerDownload(target, fileName) {
  const url = typeof target === "string" ? target : URL.createObjectURL(target);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof target !== "string") {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Export image URL as specified format at original full resolution.
 * Never captures UI, stage, transformer, or preview overlays.
 * @param {string} sourceUrl
 * @param {"png" | "jpeg"} format
 * @param {number} [quality=0.92]
 * @param {string} [baseName="image-fixer-edit"]
 * @returns {Promise<void>}
 */
export async function exportCleanImage(sourceUrl, format = "png", quality = 0.92, baseName = "image-fixer-edit") {
  const fileName = buildExportFileName(baseName, format);

  // If already PNG data URL or blob URL and target is PNG, download directly
  if (format === "png" && (sourceUrl.startsWith("data:image/png") || sourceUrl.startsWith("blob:"))) {
    triggerDownload(sourceUrl, fileName);
    return;
  }

  // Otherwise, render full resolution onto an offscreen canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context for export"));
        return;
      }
      if (format === "jpeg") {
        // Fill white background for JPEG so transparent areas don't render black
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      const mimeType = getMimeType(format);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to generate image file"));
            return;
          }
          triggerDownload(blob, fileName);
          resolve();
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for export"));
    img.src = sourceUrl;
  });
}
