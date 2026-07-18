import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Настройки" description="Профиль, рабочее пространство и уведомления." />
      <EmptyState
        icon={<SettingsIcon className="h-5 w-5" strokeWidth={1.5} />}
        title="Раздел в разработке"
        description="Настройки профиля и рабочего пространства появятся здесь на следующем этапе."
      />
    </div>
  );
}
