"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Feedback } from "@/lib/types";

/**
 * Frontend-only persistence for the Concept Review workflow (see
 * docs/01-PRODUCT.md — Single Source of Truth: local/exported state is a
 * snapshot, not a data source; the backend remains the eventual owner).
 * Scoped per project so different projects don't clobber each other.
 *
 * Backed by localStorage via useSyncExternalStore rather than a
 * useEffect+setState read-on-mount, so the client's first paint matches the
 * server-rendered mock-data snapshot and only diverges once the real
 * localStorage value is read (no hydration mismatch).
 */

interface ConceptReviewState {
  selectedConceptId: string | null;
  feedback: Feedback[];
}

const EMPTY_FALLBACK: ConceptReviewState = { selectedConceptId: null, feedback: [] };

function storageKey(projectId: string): string {
  return `architect-olnoo:concept-review:${projectId}`;
}

const snapshotCache = new Map<string, ConceptReviewState>();
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function readFromStorage(projectId: string, fallback: ConceptReviewState): ConceptReviewState {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as ConceptReviewState) : fallback;
  } catch {
    return fallback;
  }
}

function getSnapshot(projectId: string, fallback: ConceptReviewState): ConceptReviewState {
  if (!snapshotCache.has(projectId)) {
    snapshotCache.set(projectId, readFromStorage(projectId, fallback));
  }
  return snapshotCache.get(projectId) as ConceptReviewState;
}

function commit(projectId: string, next: ConceptReviewState) {
  snapshotCache.set(projectId, next);
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, quota) — state still works in-memory.
  }
  for (const listener of listeners) listener();
}

export function useConceptReview(
  projectId: string,
  initialSelectedConceptId: string | null,
  initialFeedback: Feedback[],
) {
  const fallback: ConceptReviewState = { selectedConceptId: initialSelectedConceptId, feedback: initialFeedback };

  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(projectId, fallback),
    () => fallback,
  );

  const selectConcept = useCallback((conceptId: string | null) => {
    const current = getSnapshot(projectId, EMPTY_FALLBACK);
    commit(projectId, { ...current, selectedConceptId: conceptId });
  }, [projectId]);

  const addFeedback = useCallback((conceptId: string, comment: string) => {
    const current = getSnapshot(projectId, EMPTY_FALLBACK);
    commit(projectId, {
      ...current,
      feedback: [
        ...current.feedback,
        {
          id: `fb-${Date.now()}`,
          conceptId,
          author: "Роман",
          createdAt: new Date().toISOString(),
          comment,
        },
      ],
    });
  }, [projectId]);

  return {
    selectedConceptId: state.selectedConceptId,
    feedback: state.feedback,
    selectConcept,
    addFeedback,
  };
}
