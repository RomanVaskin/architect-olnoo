"use client";

import { useEffect, useState } from "react";
import { cropImageToBlob, type CropRect } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

/**
 * Renders one rectangular crop of a Blob (an uploaded File or a stored
 * source-image Blob) via an in-memory canvas — the source Blob itself is
 * never modified. Used both by the wizard's Source Views confirmation step
 * (source = an in-memory File, before anything is persisted) and by the
 * Source Materials page (source = a Blob read back from IndexedDB).
 */
export function CroppedImagePreview({
  source,
  crop,
  alt,
  className,
}: {
  source: Blob;
  crop: CropRect;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    cropImageToBlob(source, crop)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crop is a plain object; compare by its primitive fields, not identity
  }, [source, crop.x, crop.y, crop.width, crop.height]);

  if (!url) {
    return <div className={cn("bg-icon-bg", className)} aria-hidden />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- object URL for an in-memory cropped Blob, not a static asset
  return <img src={url} alt={alt} className={className} />;
}
