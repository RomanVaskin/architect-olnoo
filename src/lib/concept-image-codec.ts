/**
 * Structured-clone-safe representation of a generated concept image.
 *
 * IndexedDB has thrown `DataCloneError` in production when a record held a
 * `Blob` directly (see CHANGELOG) — an `ArrayBuffer` is always
 * structured-clone-safe, so image bytes are converted to one before being
 * written and reconstructed into a `Blob` only when read back.
 */

export interface StoredImageRecord {
  imageKey: string;
  bytes: ArrayBuffer;
  mimeType: string;
}

/** Shape written before this fix — read-compatible so existing saved images are not lost. */
interface LegacyStoredImageRecord {
  imageKey: string;
  blob: Blob;
}

export type AnyStoredImageRecord = StoredImageRecord | LegacyStoredImageRecord;

function isLegacyStoredImageRecord(record: AnyStoredImageRecord): record is LegacyStoredImageRecord {
  return "blob" in record;
}

/** Converts a Blob into the structured-clone-safe shape written to IndexedDB. */
export async function blobToStoredImageRecord(imageKey: string, blob: Blob, mimeType: string): Promise<StoredImageRecord> {
  const bytes = await blob.arrayBuffer();
  return { imageKey, bytes, mimeType };
}

/** Reconstructs a Blob from a stored record, whether it's the current shape or a legacy `{ imageKey, blob }` one. */
export function storedImageRecordToBlob(record: AnyStoredImageRecord): Blob {
  if (isLegacyStoredImageRecord(record)) return record.blob;
  return new Blob([record.bytes], { type: record.mimeType });
}
