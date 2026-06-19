import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { WebKeyframesEditor } from "../dist/editor.js";

test("mount adds a hidden editor panel and unmount removes it", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  const panel = window.document.querySelector(".wkf");
  assert.ok(panel);
  assert.equal(panel.getAttribute("aria-hidden"), "true");
  assert.equal(panel.classList.contains("wkf--visible"), false);

  editor.unmount();

  assert.equal(window.document.querySelector(".wkf"), null);
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

  const panel = window.document.querySelector(".wkf");
  assert.ok(panel?.classList.contains("wkf--visible"));
  assert.equal(panel?.getAttribute("aria-hidden"), "false");

  editor.toggle();
  assert.equal(panel?.classList.contains("wkf--visible"), false);
  assert.equal(panel?.getAttribute("aria-hidden"), "true");

  editor.hide();
  editor.toggle();
  assert.ok(panel?.classList.contains("wkf--visible"));
});

test("header drag updates the panel position", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  editor.show();

  const panel = window.document.querySelector(".wkf__panel");
  const header = window.document.querySelector(".wkf__header");
  panel.getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    width: 360,
    height: 320,
    right: 460,
    bottom: 520,
  });

  header.dispatchEvent(
    new window.MouseEvent("mousedown", {
      bubbles: true,
      button: 0,
      clientX: 140,
      clientY: 240,
    }),
  );
  window.dispatchEvent(
    new window.MouseEvent("mousemove", {
      bubbles: true,
      clientX: 220,
      clientY: 300,
    }),
  );
  window.dispatchEvent(
    new window.MouseEvent("mouseup", {
      bubbles: true,
      clientX: 220,
      clientY: 300,
    }),
  );

  assert.equal(panel.style.left, "180px");
  assert.equal(panel.style.top, "260px");
  assert.equal(panel.style.transform, "none");
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

  const panel = window.document.querySelector(".wkf");
  assert.ok(panel?.classList.contains("wkf--visible"));
});

test("shortcut false disables keyboard toggle", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({
    root: window.document.body,
    shortcut: false,
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

  const panel = window.document.querySelector(".wkf");
  assert.equal(panel?.classList.contains("wkf--visible"), false);
});

test("data helpers stay available before and after mount", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  assert.match(editor.toJson(), /"id": "new-animation"/);
  assert.match(editor.toScss(), /@keyframes new-animation/);

  editor.mount();
  editor.setData({
    id: "hero-logo",
    duration: 900,
    keyframes: [
      {
        time: 0,
        opacity: 0,
        transforms: [
          { kind: "translate", x: 0, y: 20 },
          { kind: "scale", value: 1 },
          { kind: "rotate", value: 0 },
        ],
      },
      {
        time: 900,
        opacity: 1,
        transforms: [
          { kind: "translate", x: 0, y: 0 },
          { kind: "scale", value: 1 },
          { kind: "rotate", value: 0 },
        ],
      },
    ],
  });

  assert.equal(editor.getData().id, "hero-logo");
  assert.match(editor.toScss(), /@keyframes hero-logo/);
  const idInput = window.document.querySelector("[data-wkf-field='id']");
  assert.equal(idInput?.value, "hero-logo");
});

test("meta inputs update editor data", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setInputValue(window.document, "id", "hero-title");
  setSelectValue(window.document, "translateUnit", "vw");
  setInputValue(window.document, "translateFunctionName", "layout.wrap");
  setNumberValue(window.document, "duration", 1600);

  const data = editor.getData();
  assert.equal(data.id, "hero-title");
  assert.equal(data.translate?.unit, "vw");
  assert.equal(data.translate?.functionName, "layout.wrap");
  assert.equal(data.duration, 1600);
});

test("custom unit input keeps focus while typing", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  setSelectValue(window.document, "translateUnit", "custom");

  const input = window.document.querySelector("[data-wkf-field='translateCustomUnit']");
  input.focus();
  input.value = "v";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await Promise.resolve();

  const nextInput = window.document.querySelector("[data-wkf-field='translateCustomUnit']");
  assert.equal(window.document.activeElement, nextInput);

  nextInput.value = "vw";
  nextInput.dispatchEvent(new Event("input", { bubbles: true }));
  await Promise.resolve();

  assert.equal(window.document.activeElement, window.document.querySelector("[data-wkf-field='translateCustomUnit']"));
  assert.equal(editor.getData().translate?.customUnit, "vw");
});

test("keyframe editor updates selected frame values", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setNumberValue(window.document, "time", 300, 1);
  setNumberValue(window.document, "transform-x-0", 24);
  setNumberValue(window.document, "opacity", 0.45);

  const [firstKeyframe] = editor.getData().keyframes;
  assert.equal(firstKeyframe.time, 300);
  assert.equal(firstKeyframe.transforms[0].kind, "translate");
  assert.equal(firstKeyframe.transforms[0].x, 24);
  assert.equal(firstKeyframe.opacity, 0.45);
});

test("sparse keyframe actions can unset opacity and clear transforms", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  clickActionSync(window.document, "unset-opacity");
  assert.doesNotMatch(editor.toScss(), /0% \{\n    transform: translate\(global\.vw\(0px\), global\.vw\(40px\)\) scale\(1\) rotate\(0deg\);\n    opacity: 0;/);
  assert.match(editor.toScss(), /0% \{\n    transform: translate\(global\.vw\(0px\), global\.vw\(40px\)\) scale\(1\) rotate\(0deg\);\n  \}/);

  clickActionSync(window.document, "clear-transforms");
  assert.match(editor.toScss(), /0% \{\n    transform: none;\n  \}/);

  clickActionSync(window.document, "unset-transforms");
  assert.match(editor.toScss(), /0% \{\n  \}/);
  assert.match(getStatusText(window.document), /Unset transforms/);
});

test("deleting the last transform sets transform to none", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");

  assert.deepEqual(editor.getData().keyframes[0].transforms, []);
  assert.match(editor.toScss(), /0% \{\n    transform: none;\n    opacity: 0;\n  \}/);
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

test("duplicate keyframe action inserts a copied frame and keeps timeline percentages visible", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  const beforeText = window.document.body.textContent ?? "";
  assert.match(beforeText, /0%/);
  assert.match(beforeText, /100%/);

  await clickAction(window.document, "duplicate-keyframe");

  const data = editor.getData();
  assert.equal(data.keyframes.length, 3);
  assert.equal(data.keyframes[1].time, 120);
  assert.deepEqual(data.keyframes[1].transforms, data.keyframes[0].transforms);
  assert.match(window.document.body.textContent ?? "", /10% of timeline/);
});

test("copy actions write JSON and SCSS to the clipboard", async () => {
  const { window, clipboardWrites } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "copy-json");
  await clickAction(window.document, "copy-scss");

  assert.match(clipboardWrites[0], /"id": "new-animation"/);
  assert.match(clipboardWrites[1], /@keyframes new-animation/);
  assert.match(getStatusText(window.document), /Copied SCSS to clipboard/);
});

test("copy actions show an error when the clipboard API is unavailable", async () => {
  const { window } = createWindow({ withClipboard: false });
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "copy-json");

  assert.match(getStatusText(window.document), /Clipboard API is not available/);
});

test("copy actions surface validation errors instead of crashing the editor", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  setInputValue(window.document, "id", "");

  await clickAction(window.document, "copy-json");

  assert.match(getStatusText(window.document), /id is required/);
});

test("preview applies generated keyframes to matching animation-name targets and can be reset", async () => {
  const { window } = createWindow();
  const target = window.document.createElement("div");
  target.className = "preview-target";
  window.document.body.append(target);
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => {
    if (element === target) {
      return { animationName: "new-animation" };
    }

    return originalGetComputedStyle(element);
  };

  const editor = new WebKeyframesEditor({ root: window.document.body });
  editor.mount();

  await clickAction(window.document, "run-preview");

  const style = window.document.head.querySelector("style[data-wkf-preview='true']");
  assert.ok(style);
  assert.match(style.textContent ?? "", /@keyframes new-animation__wkf_preview/);
  assert.equal(target.style.animationName, "new-animation__wkf_preview");
  assert.match(getStatusText(window.document), /Applied preview to 1 element/);

  await clickAction(window.document, "reset-preview");

  assert.equal(window.document.head.querySelector("style[data-wkf-preview='true']"), null);
  assert.equal(target.style.animationName, "");
  assert.match(getStatusText(window.document), /Reset preview/);
});

test("preview reports a clear error when no target uses the current animation-name", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  await clickAction(window.document, "run-preview");

  assert.match(getStatusText(window.document), /No elements using animation-name "new-animation" were found/);
});

test("view actions open JSON and SCSS previews and can be closed", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "view-json");
  assert.match(getPreviewValue(window.document), /"id": "new-animation"/);

  await clickAction(window.document, "view-scss");
  assert.match(getPreviewValue(window.document), /@keyframes new-animation/);

  await clickAction(window.document, "close-preview");
  assert.equal(getPreviewValue(window.document), "");
});

test("escape closes an open preview", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  await clickAction(window.document, "view-json");
  assert.match(getPreviewValue(window.document), /"id": "new-animation"/);

  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }),
  );

  assert.equal(getPreviewValue(window.document), "");
  assert.match(getStatusText(window.document), /Closed preview/);
});

test("reset restores default data after edits", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  setInputValue(window.document, "id", "custom-id");
  setNumberValue(window.document, "transform-x-0", 48);

  await clickAction(window.document, "reset");

  const data = editor.getData();
  assert.equal(data.id, "new-animation");
  assert.equal(data.keyframes[0].transforms[0].kind, "translate");
  assert.equal(data.keyframes[0].transforms[0].x, 0);
  assert.match(getStatusText(window.document), /Reset editor data to defaults/);
});

test("transform controls can reorder and retarget transform operations", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "move-transform-down");
  setSelectValue(window.document, "transform-kind-0", "skew");
  setNumberValue(window.document, "transform-x-0", 12);
  setNumberValue(window.document, "transform-y-0", -6);

  const [firstKeyframe] = editor.getData().keyframes;
  assert.equal(firstKeyframe.transforms[0].kind, "skew");
  assert.equal(firstKeyframe.transforms[0].x, 12);
  assert.equal(firstKeyframe.transforms[0].y, -6);
  assert.equal(firstKeyframe.transforms[1].kind, "translate");
});

test("view actions surface validation errors when output cannot be generated", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  setInputValue(window.document, "id", "");

  await clickAction(window.document, "view-json");

  assert.match(getStatusText(window.document), /id is required/);
});

function createWindow(options = {}) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const clipboardWrites = [];
  const navigatorValue = options.withClipboard === false
    ? dom.window.navigator
    : {
        ...dom.window.navigator,
        clipboard: {
          writeText: async (text) => {
            clipboardWrites.push(text);
          },
        },
      };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  Object.defineProperty(dom.window, "navigator", {
    value: navigatorValue,
    configurable: true,
  });
  return { window: dom.window, clipboardWrites };
}

function setInputValue(document, field, value) {
  const input = document.querySelector(`[data-wkf-field='${field}']`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(document, field, value) {
  const input = document.querySelector(`[data-wkf-field='${field}']`);
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNumberValue(document, field, value, index = 0) {
  const inputs = document.querySelectorAll(`[data-wkf-field='${field}']`);
  const input = inputs[index];
  input.value = String(value);
  input.dispatchEvent(new Event(input.type === "range" ? "input" : "change", { bubbles: true }));
}

function clickActionSync(document, action) {
  const button = document.querySelector(`[data-wkf-action='${action}']`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function clickAction(document, action) {
  const button = document.querySelector(`[data-wkf-action='${action}']`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

function getStatusText(document) {
  return document.querySelector("[data-wkf-status]")?.textContent ?? "";
}

function getPreviewValue(document) {
  return document.querySelector(".wkf__preview-textarea")?.value ?? "";
}
