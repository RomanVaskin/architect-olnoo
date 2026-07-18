import { cn } from "@/lib/utils";

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

const variants = ["", "architect-scene--graphite", "architect-scene--wood", "architect-scene--sand"];

export function ProjectThumbnail({ seed, className }: { seed: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label="Архитектурное превью проекта"
      className={cn("architect-scene", variants[hashSeed(seed) % variants.length], className)}
    />
  );
}
