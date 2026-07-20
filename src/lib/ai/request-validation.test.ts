import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "./errors";
import { MAX_TOTAL_INLINE_IMAGE_BYTES, formatCombinedImageSizeError, validateCorrectionForm, validateGenerationForm } from "./request-validation";

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

test("accepts an explicit automatic-review choice and defaults to disabled when omitted", async () => {
  const enabled = baseFormData();
  enabled.append("images", makeImageFile("front.png", 16));
  enabled.append("autoReview", "true");
  assert.equal((await validateGenerationForm(enabled)).autoReview, true);

  const omitted = baseFormData();
  omitted.append("images", makeImageFile("front.png", 16));
  assert.equal((await validateGenerationForm(omitted)).autoReview, false);

  const invalid = baseFormData();
  invalid.append("images", makeImageFile("front.png", 16));
  invalid.append("autoReview", "yes");
  await assert.rejects(() => validateGenerationForm(invalid), /автоматической проверки/);
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

function correctionFormData(): FormData {
  const formData = new FormData();
  formData.append("images", makeImageFile("generated.png", 16));
  formData.append("images", makeImageFile("primary.png", 16));
  formData.append("sourceConceptId", "concept-1");
  formData.append("goal", "Сделать фасад светлее");
  formData.append("findings", JSON.stringify(["roof: changed pitch"]));
  formData.append("roles", JSON.stringify(["other", "front"]));
  formData.append("mode", "balanced");
  return formData;
}

test("correction validation requires current concept plus original primary and preserves their purposes", async () => {
  const result = await validateCorrectionForm(correctionFormData());
  assert.deepEqual(result.images.map(({ role, purpose }) => ({ role, purpose })), [
    { role: "other", purpose: "correction-target" },
    { role: "front", purpose: "primary" },
  ]);
  assert.deepEqual(result.findings, ["roof: changed pitch"]);
  assert.equal(result.sourceConceptId, "concept-1");
});

test("correction validation rejects a request without concrete reviewer findings", async () => {
  const formData = correctionFormData();
  formData.set("findings", "[]");
  await assert.rejects(() => validateCorrectionForm(formData), /конкретные замечания/);
});

test("correction validation rejects malformed image roles", async () => {
  const formData = correctionFormData();
  formData.set("roles", JSON.stringify(["other", "unknown"]));
  await assert.rejects(() => validateCorrectionForm(formData), /Роли изображений/);
});
