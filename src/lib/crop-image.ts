import type { PixelBuffer } from "@/lib/collage-detector";

/**
 * Browser-only bridge between stored/uploaded image Blobs and the pure,
 * DOM-free collage detector: decodes a Blob into raw pixel data for
 * detection, and crops a Blob to a rectangle for preview — both via an
 * in-memory canvas, never touching or re-encoding the original stored
 * bytes. Every export here must be called from a Client Component.
 */

/** Decodes a Blob into raw RGBA pixel data (for collage detection) plus its natural dimensions. */
export async function decodeImagePixels(source: Blob): Promise<{ pixelBuffer: PixelBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { pixelBuffer: { width: bitmap.width, height: bitmap.height, data: imageData.data }, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Draws the given rectangle of `source` onto a fresh canvas and exports it as a new Blob — the source Blob is never modified. */
export async function cropImageToBlob(source: Blob, crop: CropRect, mimeType = "image/png"): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), mimeType);
    });
  } finally {
    bitmap.close();
  }
}
