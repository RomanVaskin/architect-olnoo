"use client";

import { FileImage, FileText, File as FileIcon, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CroppedImagePreview } from "@/components/ui/cropped-image-preview";
import { useBlobUrl } from "@/lib/use-blob-url";
import { useFetchedBlob } from "@/lib/use-fetched-blob";
import { useRefreshableImageSrc } from "@/lib/use-refreshable-image-src";
import { formatDate } from "@/lib/utils";
import { SOURCE_VIEW_ROLE_LABELS, type SourceFile, type SourceView } from "@/lib/types";

const fileIconClassName = "h-4 w-4";

function fileIcon(kind: SourceFile["kind"]) {
  switch (kind) {
    case "photo":
      return <FileImage className={fileIconClassName} strokeWidth={1.5} />;
    case "drawing":
      return <FileText className={fileIconClassName} strokeWidth={1.5} />;
    default:
      return <FileIcon className={fileIconClassName} strokeWidth={1.5} />;
  }
}

/** Shows the real stored original thumbnail — from an IndexedDB blob (local projects) or a signed Storage URL (server projects); a kind icon otherwise. */
function SourceFileThumbnail({ file, projectId }: { file: SourceFile; projectId?: string }) {
  const blobUrl = useBlobUrl(file.imageBlob);
  const { src: refreshableUrl, onError } = useRefreshableImageSrc(projectId, file.id, file.imageUrl);
  const url = file.imageUrl ? refreshableUrl : blobUrl;
  if (!url) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-icon-bg text-ink-secondary">
        {fileIcon(file.kind)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- object URL for a locally stored source-image blob or a signed Storage URL, not a static asset
  return <img src={url} onError={file.imageUrl ? onError : undefined} alt={file.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
}

/** Renders the confirmed Source Views for one file — needs a real Blob to crop client-side, so it fetches the signed URL once when there's no local IndexedDB blob to reuse. */
function SourceFileViews({ file, fileViews }: { file: SourceFile; fileViews: SourceView[] }) {
  const remoteBlob = useFetchedBlob(file.imageBlob ? undefined : file.imageUrl);
  const source = file.imageBlob ?? remoteBlob;
  if (fileViews.length === 0 || !source) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {fileViews.map((view) => (
        <div key={view.id} className="w-28 shrink-0">
          <CroppedImagePreview
            source={source}
            crop={view.crop}
            alt={`${file.name} — ${SOURCE_VIEW_ROLE_LABELS[view.role]}`}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Badge className="px-2 py-0.5 text-[10px]">{SOURCE_VIEW_ROLE_LABELS[view.role]}</Badge>
            {view.isPrimary ? (
              <Badge variant="accent" className="gap-1 px-2 py-0.5 text-[10px]">
                <Star className="h-3 w-3" strokeWidth={1.5} />
                Основной
              </Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FileList({ files, views = [], emptyLabel, projectId }: { files: SourceFile[]; views?: SourceView[]; emptyLabel: string; projectId?: string }) {
  if (files.length === 0) {
    return <EmptyState title="Пока нет файлов" description={emptyLabel} />;
  }

  return (
    <Card className="divide-y divide-border">
      {files.map((file) => {
        const fileViews = views.filter((view) => view.sourceImageId === file.id).sort((a, b) => a.order - b.order);
        return (
          <div key={file.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <SourceFileThumbnail file={file} projectId={projectId} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{file.name}</p>
                <p className="text-xs text-ink-secondary">
                  Загружено {formatDate(file.uploadedAt)}
                  {file.dimensions ? ` · ${file.dimensions.width}×${file.dimensions.height}px` : ""}
                </p>
              </div>
            </div>
            <SourceFileViews file={file} fileViews={fileViews} />
          </div>
        );
      })}
    </Card>
  );
}
