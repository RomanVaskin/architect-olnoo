/**
 * Decodes a base64 string into a Blob without going through a `data:` URL.
 *
 * `fetch(\`data:...;base64,${data}\`)` silently fails or hangs on some
 * browsers/runtimes once the payload gets large (multi-MB generated images),
 * so decode explicitly in bounded chunks instead.
 */
export function base64ToBlob(base64: string, mimeType: string, chunkSize = 8192): Blob {
  const binary = atob(base64);
  const chunks: Uint8Array<ArrayBuffer>[] = [];

  for (let offset = 0; offset < binary.length; offset += chunkSize) {
    const slice = binary.slice(offset, offset + chunkSize);
    const bytes = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i);
    }
    chunks.push(bytes);
  }

  return new Blob(chunks, { type: mimeType });
}
