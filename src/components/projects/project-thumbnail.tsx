import { cn } from "@/lib/utils";

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

const variants = ["", "architect-scene--graphite", "architect-scene--wood", "architect-scene--sand"];

/** `imageUrl` (a signed Storage URL, only ever set for server projects — see project-repository.ts) renders the real cover photo; otherwise falls back to the existing decorative placeholder keyed by `seed`. */
export function ProjectThumbnail({ seed, imageUrl, className }: { seed: string; imageUrl?: string; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset
    return <img src={imageUrl} alt="Превью проекта" className={cn("object-cover", className)} />;
  }

  return (
    <div
      role="img"
      aria-label="Архитектурное превью проекта"
      className={cn("architect-scene", variants[hashSeed(seed) % variants.length], className)}
    />
  );
}
