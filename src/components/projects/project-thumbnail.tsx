import { Home, Building2, TreePine, Building } from "lucide-react";
import { cn } from "@/lib/utils";

function hashSeed(seed: string): number {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

const iconClassName = "h-8 w-8 text-ink-secondary";

function projectIcon(seed: string) {
  switch (hashSeed(seed) % 4) {
    case 0:
      return <Home className={iconClassName} strokeWidth={1.5} />;
    case 1:
      return <Building2 className={iconClassName} strokeWidth={1.5} />;
    case 2:
      return <TreePine className={iconClassName} strokeWidth={1.5} />;
    default:
      return <Building className={iconClassName} strokeWidth={1.5} />;
  }
}

export function ProjectThumbnail({ seed, className }: { seed: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-icon-bg", className)}>
      {projectIcon(seed)}
    </div>
  );
}
