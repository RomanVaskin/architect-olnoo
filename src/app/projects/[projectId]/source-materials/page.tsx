"use client";

import { useProjectContext } from "@/lib/project-context";
import { FileList } from "@/components/workspace/file-list";

export default function SourceMaterialsPage() {
  const { project } = useProjectContext();
  if (!project) return null;

  return (
    <FileList
      files={project.sourceFiles}
      emptyLabel="Загрузите фотографии, чертежи или документы существующего дома, чтобы начать работу."
    />
  );
}
