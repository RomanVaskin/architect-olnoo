import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "./errors";
import { MAX_TOTAL_INLINE_IMAGE_BYTES, formatCombinedImageSizeError, validateGenerationForm } from "./request-validation";

function makeImageFile(name: string, sizeBytes: number, type = "image/png"): File {
  return new File([Buffer.alloc(sizeBytes)], name, { type });
}

function baseFormData(): FormData {
  const formData = new FormData();
  formData.append("goal", "Сделать фасад светлее");
  formData.append("explicitChanges", "Заменить облицовку");
  formData.append("mustKeep", JSON.stringify(["Геометрия"]));
  formData.append("mayChange", JSON.stringify(["Материалы"]));
  formData.append("mode", "balanced");
  formData.append("variantCount", "1");
  return formData;
}

test("rejects images whose combined raw size exceeds the conservative inline-payload cap", async () => {
  const formData = baseFormData();
  const perFile = Math.floor(MAX_TOTAL_INLINE_IMAGE_BYTES / 2) + 1024 * 1024; // two files just over half the cap each
  formData.append("images", makeImageFile("a.png", perFile));
  formData.append("images", makeImageFile("b.png", perFile));

  await assert.rejects(
    () => validateGenerationForm(formData),
    (error: unknown) => {
      assert.ok(error instanceof GenerationError);
      assert.equal(error.code, "validation");
      assert.match(error.message, /Суммарный размер изображений/);
      return true;
    },
  );
});

test("accepts images whose combined raw size stays under the inline-payload cap", async () => {
  const formData = baseFormData();
  formData.append("images", makeImageFile("a.png", 1024 * 1024));
  formData.append("images", makeImageFile("b.png", 1024 * 1024));

  const result = await validateGenerationForm(formData);
  assert.equal(result.images.length, 2);
  assert.equal(result.mode, "balanced");
});

test("formatCombinedImageSizeError reports both the actual and the limit size in MB", () => {
  const message = formatCombinedImageSizeError(15 * 1024 * 1024);
  assert.match(message, /15\.0 МБ/);
  assert.match(message, /12 МБ/);
});

test("still rejects more than 3 images even when combined size is small", async () => {
  const formData = baseFormData();
  formData.append("images", makeImageFile("a.png", 1024));
  formData.append("images", makeImageFile("b.png", 1024));
  formData.append("images", makeImageFile("c.png", 1024));
  formData.append("images", makeImageFile("d.png", 1024));

  await assert.rejects(
    () => validateGenerationForm(formData),
    (error: unknown) => {
      assert.ok(error instanceof GenerationError);
      assert.match(error.message, /не более 3 изображений/);
      return true;
    },
  );
});

test("preserves one primary image followed by typed multi-view references", async () => {
  const formData = baseFormData();
  formData.append("images", makeImageFile("front.png", 16));
  formData.append("images", makeImageFile("side.png", 16));
  formData.append("imageContexts", JSON.stringify([
    { role: "front", purpose: "primary" },
    { role: "side", purpose: "reference" },
  ]));

  const result = await validateGenerationForm(formData);
  assert.deepEqual(result.images.map(({ role, purpose }) => ({ role, purpose })), [
    { role: "front", purpose: "primary" },
    { role: "side", purpose: "reference" },
  ]);
});

test("rejects missing, duplicated, or reordered primary image context", async () => {
  for (const contexts of [
    [{ role: "front", purpose: "reference" }, { role: "side", purpose: "reference" }],
    [{ role: "front", purpose: "primary" }, { role: "side", purpose: "primary" }],
    [{ role: "front", purpose: "reference" }, { role: "side", purpose: "primary" }],
  ]) {
    const formData = baseFormData();
    formData.append("images", makeImageFile("front.png", 16));
    formData.append("images", makeImageFile("side.png", 16));
    formData.append("imageContexts", JSON.stringify(contexts));
    await assert.rejects(() => validateGenerationForm(formData), /Первое изображение должно быть единственным основным ракурсом/);
  }
});
