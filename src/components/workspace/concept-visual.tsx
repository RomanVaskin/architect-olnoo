"use client";

import type { ReactNode } from "react";
import { useBlobUrl } from "@/lib/use-blob-url";
import { GENERATION_MODE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Concept } from "@/lib/types";

function sceneClassFor(conceptId: string) {
  const variant = conceptId.charCodeAt(conceptId.length - 1) % 3;
  return variant === 0 ? "architect-scene--graphite" : variant === 1 ? "architect-scene--wood" : "";
}

/**
 * Renders a concept's visual: the real generated image (with a link to open
 * it full-resolution and a generation-mode badge) when one exists, or the
 * existing placeholder scene for mock concepts that were never generated.
 * Never implies the result is construction-ready or specialist-verified.
 */
export function ConceptVisual({
  concept,
  heightClassName,
  badge,
}: {
  concept: Concept;
  heightClassName: string;
  badge?: ReactNode;
}) {
  const blobUrl = useBlobUrl(concept.generatedImage?.blob);

  if (concept.generatedImage) {
    return (
      <div className={cn("relative overflow-hidden bg-icon-bg", heightClassName)}>
        {blobUrl ? (
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
            title="Открыть изображение в полном разрешении"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob, not a static asset */}
            <img
              src={blobUrl}
              alt={`${concept.label} — сгенерированная архитектурная визуализация, автоматическая проверка геометрии не выполнена`}
              className="h-full w-full object-cover"
            />
          </a>
        ) : null}
        {badge}
        <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-white">
          {GENERATION_MODE_LABELS[concept.generatedImage.mode]}
        </span>
      </div>
    );
  }

  return <div className={cn("architect-scene", sceneClassFor(concept.id), heightClassName)}>{badge}</div>;
}
