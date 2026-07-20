import type { ArchitecturalConstraints } from "./types";

export function buildCorrectionPrompt(
  constraints: ArchitecturalConstraints,
  findings: string[],
  hasReferenceView: boolean,
): string {
  return [
    "You are correcting an existing photorealistic architectural redesign, not creating a new design direction.",
    "IMAGE 1 is the GENERATED CONCEPT TO EDIT. Preserve its approved materials, colours, lighting and design intent.",
    "IMAGE 2 is the ORIGINAL PRIMARY VIEW and the authoritative reference for camera, building geometry, volumes, roof, openings and proportions.",
    hasReferenceView
      ? "IMAGE 3 is an ORIGINAL REFERENCE VIEW of the same house. Use it only to understand geometry hidden in the primary view; output must still use the IMAGE 1 / IMAGE 2 camera."
      : "No additional original reference view is available.",
    "Correct only the listed Quality Gate findings. Do not introduce any unrelated redesign or new architectural element.",
    "",
    "Quality Gate findings to correct:",
    findings.map((finding) => `- ${finding}`).join("\n"),
    "",
    "Original user goal:",
    constraints.goal,
    "",
    "Elements that MUST remain unchanged:",
    constraints.mustKeep.length ? constraints.mustKeep.map((item) => `- ${item}`).join("\n") : "- Overall geometry and proportions",
    "",
    "Hard rules:",
    "- Output exactly one corrected photorealistic image.",
    "- Preserve the camera, crop and perspective of IMAGE 1 and IMAGE 2.",
    "- Restore original building geometry where a Quality Gate finding identifies a possible deviation.",
    "- Preserve intended facade-material and colour changes from IMAGE 1 unless a finding explicitly concerns them.",
    "- Do not output a collage, text, diagram, drawing, before/after pair or abstract geometry.",
  ].join("\n");
}
