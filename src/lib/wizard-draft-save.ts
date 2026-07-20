import type { DraftProjectInput } from "./mvp-local-project-store";

/**
 * Free draft saving for the New Project wizard («Сохранить черновик»).
 *
 * The dependency shape deliberately has a single slot — the local IndexedDB
 * draft writer — mirroring PersistConceptsDeps in concept-persistence.ts: a
 * saver built from it structurally cannot reach /api/concepts/generate, the
 * cloud generation routes, or any AI provider, because nothing capable of a
 * network request is ever passed in.
 *
 * Duplicate protection is structural as well: while a save is in flight,
 * every additional call joins the same promise instead of writing a second
 * project, and after a successful save the resolved promise (or the id the
 * caller already holds) keeps being reused. Only a failed save clears the
 * in-flight slot so the user can retry.
 */
export interface WizardDraftSaver {
  save(existingProjectId: string | null, input: DraftProjectInput): Promise<string>;
}

export function createWizardDraftSaver(createDraft: (input: DraftProjectInput) => Promise<string>): WizardDraftSaver {
  let inFlight: Promise<string> | null = null;
  return {
    save(existingProjectId, input) {
      if (existingProjectId) return Promise.resolve(existingProjectId);
      if (!inFlight) {
        inFlight = createDraft(input).catch((error) => {
          inFlight = null;
          throw error;
        });
      }
      return inFlight;
    },
  };
}
