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
  const idInput = window.document.querySelector("[data-wkf-field='id']");
  assert.equal(idInput?.value, "hero-logo");
});

test("meta inputs update editor data", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setInputValue(window.document, "id", "hero-title");
  setInputValue(window.document, "target", ".js-hero-title");
  setInputValue(window.document, "unitFunction", "layout.vw");
  setNumberValue(window.document, "duration", 1600);
  setNumberValue(window.document, "designWidth", 1280);

  const data = editor.getData();
  assert.equal(data.id, "hero-title");
  assert.equal(data.target, ".js-hero-title");
  assert.equal(data.unitFunction, "layout.vw");
  assert.equal(data.duration, 1600);
  assert.equal(data.designWidth, 1280);
});

test("keyframe editor updates selected frame values", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setNumberValue(window.document, "time", 300, 1);
  setNumberValue(window.document, "x", 24);
  setNumberValue(window.document, "opacity", 0.45);

  const [firstKeyframe] = editor.getData().keyframes;
  assert.equal(firstKeyframe.time, 300);
  assert.equal(firstKeyframe.x, 24);
  assert.equal(firstKeyframe.opacity, 0.45);
});

test("add and delete keyframe actions update the list", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  clickAction(window.document, "add-keyframe");
  assert.equal(editor.getData().keyframes.length, 3);

  const keyframeButtons = window.document.querySelectorAll("[data-wkf-action='select-keyframe']");
  keyframeButtons[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  clickAction(window.document, "delete-keyframe");

  assert.equal(editor.getData().keyframes.length, 2);
});

function createWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.Event = dom.window.Event;
  return dom;
}

function setInputValue(document, field, value) {
  const input = document.querySelector(`[data-wkf-field='${field}']`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setNumberValue(document, field, value, index = 0) {
  const inputs = document.querySelectorAll(`[data-wkf-field='${field}']`);
  const input = inputs[index];
  input.value = String(value);
  input.dispatchEvent(new Event(input.type === "range" ? "input" : "change", { bubbles: true }));
}

function clickAction(document, action) {
  const button = document.querySelector(`[data-wkf-action='${action}']`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}
