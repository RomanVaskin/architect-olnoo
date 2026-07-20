import sharp, { type Sharp } from "sharp";
import type { SourceViewCropRect } from "@/lib/types";

/**
 * Server-side counterpart to src/lib/crop-image.ts (which is browser-canvas
 * based and cannot run in a Route Handler). Used only for cloud generation,
 * where source bytes come from Supabase Storage instead of an in-browser
 * File — see cloud-generation-source.ts. Crops are trusted server-side data
 * (project_files/source_views rows the caller already owns via RLS), not
 * client input, so this never re-validates bounds — callers that read crop
 * rects from a request body must validate them first.
 */
export async function cropImageBuffer(bytes: Buffer, crop: SourceViewCropRect, mimeType: string): Promise<Buffer> {
  const image = sharp(bytes).extract({
    left: Math.round(crop.x),
    top: Math.round(crop.y),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  });
  return outputFormat(image, mimeType).toBuffer();
}

function outputFormat(image: Sharp, mimeType: string): Sharp {
  if (mimeType === "image/png") return image.png();
  if (mimeType === "image/webp") return image.webp();
  return image.jpeg();
}
