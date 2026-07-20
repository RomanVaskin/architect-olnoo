import { AlertTriangle, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  GEOMETRY_SPECIALIST_REVIEW_NOTE,
  GEOMETRY_VERIFICATION_NOTE,
  type Concept,
  type GeometryCheckKey,
  type GeometryVerificationReport,
} from "@/lib/types";

const CHECK_LABELS: Record<GeometryCheckKey, string> = {
  camera: "Ракурс и перспектива",
  volumes: "Объёмы и этажность",
  roof: "Геометрия крыши",
  openings: "Положение окон и дверей",
  proportions: "Пропорции и пятно здания",
};

export function geometryVerificationLabel(report?: GeometryVerificationReport): string {
  if (!report || report.status === "not-run") return GEOMETRY_VERIFICATION_NOTE;
  if (report.status === "possible-deviations") return "AI-анализ обнаружил возможные геометрические расхождения";
  if (report.status === "no-obvious-deviations") return "AI-анализ не обнаружил явных геометрических расхождений";
  return "AI-анализ не дал достаточно уверенного результата";
}

export function GeometryVerificationLine({ concept, className = "" }: { concept: Concept; className?: string }) {
  return (
    <p className={`text-xs text-ink-secondary ${className}`.trim()}>
      {geometryVerificationLabel(concept.geometryVerification)} · {GEOMETRY_SPECIALIST_REVIEW_NOTE}
    </p>
  );
}

export function GeometryVerificationPanel({ report }: { report?: GeometryVerificationReport }) {
  const hasReport = report && report.status !== "not-run" && report.checks.length > 0;
  const Icon = report?.status === "possible-deviations" ? AlertTriangle : hasReport ? Search : ShieldAlert;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-action" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-ink">Предварительная AI-проверка геометрии</h3>
          <p className="mt-1 text-sm text-ink-secondary">{geometryVerificationLabel(report)}</p>
          <p className="mt-1 text-xs font-medium text-action">{GEOMETRY_SPECIALIST_REVIEW_NOTE}</p>
        </div>
      </div>

      {hasReport ? (
        <div className="mt-4 divide-y divide-border border-t border-border">
          {report.checks.map((check) => (
            <div key={check.key} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
              <div>
                <p className="text-sm font-medium text-ink">{CHECK_LABELS[check.key]}</p>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  {check.status === "consistent"
                    ? "Явных расхождений не найдено"
                    : check.status === "possible-deviation"
                      ? "Возможно расхождение"
                      : "Недостаточно данных"}
                  {` · уверенность ${Math.round(check.confidence * 100)}%`}
                </p>
              </div>
              <p className="text-sm leading-5 text-ink-secondary">{check.explanation}</p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-ink-secondary">
        {report?.advisory ?? "Предварительная AI-проверка по изображениям не заменяет проверку архитектора или другого квалифицированного специалиста."}
      </p>
    </Card>
  );
}
