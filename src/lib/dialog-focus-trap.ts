/**
 * Pure decision logic for modal dialog keyboard behavior, kept free of DOM
 * APIs so it can be unit tested directly — see use-dialog-a11y.ts for the
 * thin effect/listener wiring that calls these functions against the real
 * document. Shared by every generation/correction dialog (see specs — a
 * user must never be able to accidentally dismiss a dialog with a paid
 * request in flight, but Tab/Shift+Tab must still stay trapped and Escape
 * must still work once it's safe to close).
 */

/** Escape closes the dialog only when the caller says closing is currently safe. */
export function shouldCloseOnEscape(key: string, closeDisabled: boolean): boolean {
  return key === "Escape" && !closeDisabled;
}

/**
 * Decides where Tab/Shift+Tab should move focus at a trap boundary.
 * `activeIndex` is the currently focused element's index among the dialog's
 * focusable elements, or -1 if focus has somehow landed outside the dialog
 * (e.g. the previously focused element was removed from the DOM).
 *
 * Returns the index to focus instead, or `null` to let the browser's native
 * Tab order handle it (every position that isn't a boundary) — the caller
 * only needs to intervene at the edges, not on every keystroke.
 */
export function nextTrapFocusIndex(count: number, activeIndex: number, shiftKey: boolean): number | null {
  if (count === 0) return null;
  if (activeIndex === -1) return shiftKey ? count - 1 : 0;
  if (shiftKey) return activeIndex === 0 ? count - 1 : null;
  return activeIndex === count - 1 ? 0 : null;
}
