"use client";

import type { ReactNode } from "react";
import { useBlobUrl } from "@/lib/use-blob-url";
import { useRefreshableImageSrc } from "@/lib/use-refreshable-image-src";
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
 * `projectId` is only needed for server (Supabase) concepts, to recover from
 * an expired signed URL — see useRefreshableImageSrc.
 */
export function ConceptVisual({
  concept,
  heightClassName,
  badge,
  projectId,
}: {
  concept: Concept;
  heightClassName: string;
  badge?: ReactNode;
  projectId?: string;
}) {
  const blobUrl = useBlobUrl(concept.generatedImage?.blob);
  const { src: refreshableUrl, onError } = useRefreshableImageSrc(projectId, concept.generatedImage?.fileId, concept.generatedImage?.url);
  const displayUrl = concept.generatedImage?.url ? refreshableUrl : blobUrl;

  if (concept.generatedImage) {
    return (
      <div className={cn("relative overflow-hidden bg-icon-bg", heightClassName)}>
        {displayUrl ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
            title="Открыть изображение в полном разрешении"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB blob or a signed Storage URL, not a static asset */}
            <img
              src={displayUrl}
              onError={concept.generatedImage.url ? onError : undefined}
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
