import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { FileList } from "@/components/workspace/file-list";

export default async function SourceMaterialsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  return (
    <FileList
      files={project.sourceFiles}
      emptyLabel="Загрузите фотографии, чертежи или документы существующего дома, чтобы начать работу."
    />
  );
}
