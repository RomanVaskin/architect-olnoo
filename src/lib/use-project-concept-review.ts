"use client";

import { useCallback, useState } from "react";
import type { Feedback, Project } from "./types";
import { useConceptReview } from "./use-concept-review";
import { isServerProjectId } from "./project-id";
import { postConceptFeedback, postSelectedConcept, ServerProjectError } from "./server-project-client";

export interface ProjectConceptReviewState {
  selectedConceptId: string | null;
  feedback: Feedback[];
  selectConcept: (conceptId: string | null) => void;
  addFeedback: (conceptId: string, comment: string) => void;
  error: string | null;
}

/** Selected-concept + feedback persisted through the server repository (see docs/07-API.md) — optimistic, rolled back to the previous selection on failure. */
function useServerConceptReview(project: Project): ProjectConceptReviewState {
  const [selectedConceptId, setSelectedConceptId] = useState(project.selectedConceptId);
  const [feedback, setFeedback] = useState(project.feedback);
  const [error, setError] = useState<string | null>(null);

  const selectConcept = useCallback(
    (conceptId: string | null) => {
      setSelectedConceptId((previous) => {
        postSelectedConcept(project.id, conceptId)
          .then(() => setError(null))
          .catch((err) => {
            setSelectedConceptId(previous);
            setError(err instanceof ServerProjectError ? err.message : "Не удалось сохранить выбор концепции.");
          });
        return conceptId;
      });
    },
    [project.id],
  );

  const addFeedback = useCallback(
    (conceptId: string, comment: string) => {
      setError(null);
      postConceptFeedback(project.id, conceptId, comment)
        .then((saved) => setFeedback((previous) => [...previous, saved]))
        .catch((err) => {
          setError(err instanceof ServerProjectError ? err.message : "Не удалось сохранить отзыв.");
        });
    },
    [project.id],
  );

  return { selectedConceptId, feedback, selectConcept, addFeedback, error };
}

/**
 * Dispatches to the localStorage-backed review (src/lib/use-concept-review.ts,
 * unchanged) for local/demo projects, or the server-persisted review above
 * for Supabase projects. Both hooks are always called (never conditionally)
 * so this stays a valid hook regardless of which project type renders.
 */
export function useProjectConceptReview(project: Project): ProjectConceptReviewState {
  const local = useConceptReview(project.id, project.selectedConceptId, project.feedback);
  const server = useServerConceptReview(project);
  return isServerProjectId(project.id) ? server : { ...local, error: null };
}
