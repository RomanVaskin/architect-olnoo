import { GenerationError } from "./errors";
import type { GenerationMode } from "@/lib/types";
import type { ArchitecturalConstraints, SourceImageInput } from "./types";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGES = 3;
const MAX_TEXT_LENGTH = 4000;
const GENERATION_MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];

export interface ValidatedGenerationInput {
  images: SourceImageInput[];
  constraints: ArchitecturalConstraints;
  mode: GenerationMode;
  variantCount: number;
}

/**
 * Re-validates everything the client already checked (see
 * new-project-wizard.tsx) — the server never trusts client-side validation
 * alone (see docs/02-PLATFORM-ARCHITECTURE.md — Secure by default).
 */
export async function validateGenerationForm(formData: FormData): Promise<ValidatedGenerationInput> {
  const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    throw new GenerationError("validation", "Добавьте хотя бы одно исходное изображение.");
  }
  if (files.length > MAX_IMAGES) {
    throw new GenerationError("validation", `Можно передать не более ${MAX_IMAGES} изображений.`);
  }

  for (const file of files) {
    if (file.type === "application/pdf") {
      throw new GenerationError(
        "unsupported-file",
        "PDF-файлы пока нельзя передать в модель генерации изображений. Загрузите фотографию в формате JPEG, PNG или WebP.",
      );
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      throw new GenerationError(
        "unsupported-file",
        `Файл «${file.name}» имеет неподдерживаемый формат. Поддерживаются JPEG, PNG и WebP.`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new GenerationError("unsupported-file", `Файл «${file.name}» больше ${MAX_FILE_SIZE / (1024 * 1024)} МБ.`);
    }
  }

  const goal = String(formData.get("goal") ?? "").trim();
  if (!goal) {
    throw new GenerationError("validation", "Опишите цель проекта.");
  }
  if (goal.length > MAX_TEXT_LENGTH) {
    throw new GenerationError("validation", "Описание цели слишком длинное.");
  }

  const explicitChanges = String(formData.get("explicitChanges") ?? "").trim();
  if (explicitChanges.length > MAX_TEXT_LENGTH) {
    throw new GenerationError("validation", "Описание изменений слишком длинное.");
  }

  const mustKeep = parseStringArray(formData.get("mustKeep"));
  const mayChange = parseStringArray(formData.get("mayChange"));

  const modeRaw = String(formData.get("mode") ?? "");
  if (!GENERATION_MODES.includes(modeRaw as GenerationMode)) {
    throw new GenerationError("validation", "Указан неизвестный режим генерации.");
  }
  const mode = modeRaw as GenerationMode;

  const variantCountRaw = Number(formData.get("variantCount"));
  if (!Number.isInteger(variantCountRaw) || variantCountRaw < 1 || variantCountRaw > 3) {
    throw new GenerationError("validation", "Количество вариантов должно быть от 1 до 3.");
  }

  const images: SourceImageInput[] = await Promise.all(
    files.map(async (file) => ({
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    })),
  );

  return {
    images,
    constraints: { goal, explicitChanges, mustKeep, mayChange },
    mode,
    variantCount: variantCountRaw,
  };
}

function parseStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, 30)
      .map((item) => item.slice(0, 200));
  } catch {
    return [];
  }
}
