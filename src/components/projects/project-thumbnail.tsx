"use client";

import { useBlobUrl } from "@/lib/use-blob-url";
import { cn } from "@/lib/utils";

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

const variants = ["", "architect-scene--graphite", "architect-scene--wood", "architect-scene--sand"];

/**
 * `imageUrl` (a signed Storage URL, for server projects — see
 * project-repository.ts) or `imageBlob` (an in-memory Blob, for local
 * IndexedDB projects — see resolveProjectCover) renders the real cover
 * photo; otherwise falls back to the existing decorative placeholder keyed
 * by `seed`.
 */
export function ProjectThumbnail({
  seed,
  imageUrl,
  imageBlob,
  className,
}: {
  seed: string;
  imageUrl?: string;
  imageBlob?: Blob;
  className?: string;
}) {
  const blobUrl = useBlobUrl(imageBlob);
  const src = imageUrl || blobUrl;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL or a local blob object URL, not a static asset
    return <img src={src} alt="Превью проекта" className={cn("object-cover", className)} />;
  }

  return (
    <div
      role="img"
      aria-label="Архитектурное превью проекта"
      className={cn("architect-scene", variants[hashSeed(seed) % variants.length], className)}
    />
  );
}
