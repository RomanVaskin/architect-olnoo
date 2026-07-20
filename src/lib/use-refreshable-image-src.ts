"use client";

import { useCallback, useState } from "react";

/**
 * Signed Storage URLs expire (see src/lib/server/project-assets.ts). If an
 * `<img>` fails to load a signed URL that was already correct when the page
 * loaded, the most likely cause is expiry from staying on the page a long
 * time — this re-signs it once via GET /api/projects/:projectId/files/:fileId/url
 * rather than showing a broken image. Never retries more than once per src,
 * so a genuinely missing/unavailable image still falls back to the existing
 * placeholder UI instead of looping.
 */
export function useRefreshableImageSrc(projectId: string | undefined, fileId: string | undefined, initialUrl: string | undefined) {
  const [src, setSrc] = useState(initialUrl);
  const [attemptedRefresh, setAttemptedRefresh] = useState(false);
  const [failed, setFailed] = useState(false);

  const onError = useCallback(() => {
    if (attemptedRefresh || !projectId || !fileId) {
      setFailed(true);
      return;
    }
    setAttemptedRefresh(true);
    fetch(`/api/projects/${projectId}/files/${fileId}/url`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("refresh-failed"))))
      .then((body: unknown) => {
        const url = isRecord(body) && typeof body.url === "string" ? body.url : undefined;
        if (url) setSrc(url);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [attemptedRefresh, projectId, fileId]);

  return { src: failed ? undefined : src, onError };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
