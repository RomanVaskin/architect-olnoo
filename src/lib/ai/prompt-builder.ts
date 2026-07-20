import type { ArchitecturalConstraints, SourceImageInput } from "./types";

/**
 * Builds the structured prompt sent to the image-generation model (see
 * specs/exterior-agent.md). The prompt keeps the user's goal, explicit
 * requested changes, and the two constraint categories (see
 * docs/01-PRODUCT.md — Constraint Categories) clearly separated, and
 * instructs the model to edit — not reinvent — the supplied building.
 *
 * This module only builds text. It does not verify that the model actually
 * respected any constraint — geometry verification is a separate, not yet
 * implemented process (see docs/01-PRODUCT.md — Human Control).
 */
export function buildArchitecturalPrompt(
  constraints: ArchitecturalConstraints,
  variantIndex: number,
  variantCount: number,
  images: Array<Pick<SourceImageInput, "role" | "purpose">> = [],
): string {
  const { goal, explicitChanges, mustKeep, mayChange } = constraints;

  const lines: string[] = [
    "You are editing a photorealistic photo of an EXISTING house supplied as reference images.",
    "Edit the supplied house — do not invent a different building, a different plot, or a different camera setup.",
    "",
    "1. User goal:",
    goal.trim(),
    "",
    "2. Explicit requested changes (the purpose of this edit):",
    explicitChanges.trim() || "No additional explicit changes beyond the user goal above.",
    "",
    "3. Elements that may be modified if needed to satisfy the goal:",
    mayChange.length > 0 ? mayChange.map((item) => `- ${item}`).join("\n") : "- None specified beyond the requested changes.",
    "",
    "4. Elements that MUST remain unchanged:",
    mustKeep.length > 0 ? mustKeep.map((item) => `- ${item}`).join("\n") : "- Overall building geometry and proportions (default constraint).",
    "",
    "Hard rules:",
    "- Preserve the original camera angle, composition, and perspective exactly.",
    "- Preserve the building footprint, number of storeys, overall volumes, and primary proportions.",
    "- Preserve roof geometry unless explicitly listed above as an element that may be modified or explicitly requested to change.",
    "- Preserve window and door positions unless explicitly listed above as an element that may be modified or explicitly requested to change.",
    "- Only modify facade materials, colours, details, and other elements explicitly permitted or requested above.",
    "- Output a single photorealistic architectural visualization photo.",
    "- Do not output text, diagrams, collages, floor plans, technical drawings, or abstract geometric compositions.",
  ];

  if (images.length > 1) {
    lines.push(
      "",
      "Multi-view reference rules:",
      `- Image 1 is the PRIMARY EDIT TARGET (${images[0]?.role ?? "other"} view). Output must keep Image 1 camera, crop, perspective, and composition.`,
      `- Images 2–${images.length} are REFERENCE CONTEXT ONLY from other views of the same existing house.`,
      "- Use reference images only to understand consistent materials and building identity.",
      "- Do not switch the output to a reference camera angle and do not combine views into a collage.",
      "- Output exactly one edited version of Image 1.",
    );
  }

  if (variantCount > 1) {
    lines.push(
      "",
      `This is variant ${variantIndex} of ${variantCount} distinct design directions for the same brief — make it visibly different from the other variants while still following every rule above.`,
    );
  }

  return lines.join("\n");
}
