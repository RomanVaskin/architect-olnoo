"use client";

import { useEffect, useState } from "react";

/**
 * Fetches a URL into a Blob once, for the one case that still needs an
 * actual Blob rather than a src string: client-side cropping
 * (CroppedImagePreview draws onto a canvas). Used only for server-project
 * source views, where the original photo lives behind a signed Storage URL
 * instead of an IndexedDB blob — the signed URL is itself the credential, so
 * this is a plain unauthenticated fetch.
 */
export function useFetchedBlob(url: string | undefined): Blob | undefined {
  const [blob, setBlob] = useState<Blob | undefined>(undefined);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    fetch(url)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("fetch-failed"))))
      .then((fetched) => {
        if (!cancelled) setBlob(fetched);
      })
      .catch(() => {
        if (!cancelled) setBlob(undefined);
      });
    return () => {
      cancelled = true;
      setBlob(undefined);
    };
  }, [url]);

  return blob;
}
