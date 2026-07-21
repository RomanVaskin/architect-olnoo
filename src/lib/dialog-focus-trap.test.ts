import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTrapFocusIndex, shouldCloseOnEscape } from "./dialog-focus-trap";

test("Escape closes only when it isn't a different key", () => {
  assert.equal(shouldCloseOnEscape("Escape", false), true);
  assert.equal(shouldCloseOnEscape("Enter", false), false);
  assert.equal(shouldCloseOnEscape("Tab", false), false);
});

test("Escape never closes while an active paid request forbids it", () => {
  assert.equal(shouldCloseOnEscape("Escape", true), false);
});

test("an empty dialog (no focusable elements) never intercepts Tab", () => {
  assert.equal(nextTrapFocusIndex(0, -1, false), null);
  assert.equal(nextTrapFocusIndex(0, -1, true), null);
});

test("Tab from the last element wraps to the first", () => {
  assert.equal(nextTrapFocusIndex(3, 2, false), 0);
});

test("Shift+Tab from the first element wraps to the last", () => {
  assert.equal(nextTrapFocusIndex(3, 0, true), 2);
});

test("Tab/Shift+Tab away from a boundary is left to native browser behavior", () => {
  assert.equal(nextTrapFocusIndex(4, 1, false), null);
  assert.equal(nextTrapFocusIndex(4, 2, true), null);
});

test("focus that has escaped the dialog (index -1) snaps back inside on either direction", () => {
  assert.equal(nextTrapFocusIndex(3, -1, false), 0);
  assert.equal(nextTrapFocusIndex(3, -1, true), 2);
});

test("a single-element dialog wraps to itself in both directions", () => {
  assert.equal(nextTrapFocusIndex(1, 0, false), 0);
  assert.equal(nextTrapFocusIndex(1, 0, true), 0);
});
