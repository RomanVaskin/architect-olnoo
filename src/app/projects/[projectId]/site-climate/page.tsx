import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-ink-secondary">{label}</p>
      <p className="mt-1 text-base text-ink">{value}</p>
    </div>
  );
}

export default async function SiteAndClimatePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  if (!project) notFound();

  return (
    <Card className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
      <Field label="Адрес / участок" value={project.site.address} />
      <Field label="Климатическая зона" value={project.site.climateZone} />
      <Field label="Площадь участка" value={`${project.site.areaSqm.toLocaleString("ru-RU")} м²`} />
    </Card>
  );
}
