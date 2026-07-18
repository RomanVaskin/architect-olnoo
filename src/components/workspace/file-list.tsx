import { FileImage, FileText, File as FileIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { SourceFile } from "@/lib/types";

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

export function FileList({ files, emptyLabel }: { files: SourceFile[]; emptyLabel: string }) {
  if (files.length === 0) {
    return <EmptyState title="Пока нет файлов" description={emptyLabel} />;
  }

  return (
    <Card className="divide-y divide-border">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-icon-bg text-ink-secondary">
            {fileIcon(file.kind)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{file.name}</p>
            <p className="text-xs text-ink-secondary">Загружено {formatDate(file.uploadedAt)}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
