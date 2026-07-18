"use client";

import { useEffect, useState } from "react";

/** Creates an object URL for a Blob and revokes it on unmount / blob change. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!blob) return undefined;
    const objectUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are an external-system resource; the URL string only exists after createObjectURL runs, so there is no way to derive it during render.
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [blob]);

  return url;
}
