import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { WebKeyframesEditor } from "../dist/editor.js";

test("mount adds a hidden editor panel and unmount removes it", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  const panel = window.document.querySelector(".__wkf-root");
  assert.ok(panel);
  assert.equal(panel.getAttribute("aria-hidden"), "true");
  assert.equal(panel.classList.contains("__wkf-root--visible"), false);

  editor.unmount();

  assert.equal(window.document.querySelector(".__wkf-root"), null);
});

test("mount rejects a second call", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  assert.throws(() => editor.mount(), /already been called/);
});

test("show, hide, and toggle update visibility state", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  editor.show();

  const panel = window.document.querySelector(".__wkf-root");
  assert.ok(panel?.classList.contains("__wkf-root--visible"));
  assert.equal(panel?.getAttribute("aria-hidden"), "false");

  editor.toggle();
  assert.equal(panel?.classList.contains("__wkf-root--visible"), false);
  assert.equal(panel?.getAttribute("aria-hidden"), "true");

  editor.hide();
  editor.toggle();
  assert.ok(panel?.classList.contains("__wkf-root--visible"));
});

test("shortcut toggles the editor when enabled", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({
    root: window.document.body,
    shortcut: "Ctrl+Shift+K",
  });

  editor.mount();
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", {
      key: "K",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    }),
  );

  const panel = window.document.querySelector(".__wkf-root");
  assert.ok(panel?.classList.contains("__wkf-root--visible"));
});

test("data helpers stay available before and after mount", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  assert.match(editor.toJson(), /"id": "new-animation"/);
  assert.match(editor.toScss(), /@keyframes new-animation/);

  editor.mount();
  editor.setData({
    id: "hero-logo",
    target: ".js-hero-logo",
    duration: 900,
    designWidth: 1440,
    keyframes: [
      { time: 0, x: 0, y: 20, scale: 1, rotate: 0, opacity: 0 },
      { time: 900, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
    ],
  });

  assert.equal(editor.getData().id, "hero-logo");
  assert.match(editor.toScss(), /\.js-hero-logo/);
  assert.match(window.document.body.textContent ?? "", /hero-logo/);
});

function createWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  return dom;
}
