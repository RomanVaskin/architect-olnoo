"use client";

import { useEffect, useRef } from "react";
import { nextTrapFocusIndex, shouldCloseOnEscape } from "./dialog-focus-trap";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseDialogA11yOptions {
  /** Invoked when Escape is pressed and closing is currently safe (see closeDisabled). */
  onClose: () => void;
  /** True while dismissing the dialog would abandon something the workflow forbids cancelling this way (e.g. a paid request in flight) — Escape is ignored, but the focus trap and focus-return on unmount still apply. */
  closeDisabled?: boolean;
}

/**
 * Attach the returned ref to a dialog's outer `role="dialog"` element (also
 * give that element `tabIndex={-1}` so it can receive focus if the dialog
 * happens to contain no focusable controls yet). Runs once for the whole
 * lifetime the dialog is mounted — every one of these dialogs is only ever
 * rendered while open (`{condition ? <Dialog /> : null}`), so mount/unmount
 * already is open/close; there is no separate `open` flag to track.
 */
export function useDialogA11y({ onClose, closeDisabled = false }: UseDialogA11yOptions): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  // Refs are only ever written from an effect (never during render, per the
  // rules of hooks) — this one runs after every render so the mount-only
  // listener effect below always reads the latest callback/flag.
  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    const container = containerRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () => (container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []);
    (focusables()[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (shouldCloseOnEscape(event.key, closeDisabledRef.current)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const activeIndex = elements.indexOf(document.activeElement as HTMLElement);
      const target = nextTrapFocusIndex(elements.length, activeIndex, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      elements[target]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return containerRef;
}
