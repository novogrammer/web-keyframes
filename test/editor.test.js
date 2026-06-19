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

test("data helpers stay available before and after mount", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  assert.match(editor.toJson(), /"timelines"/);
  assert.match(editor.toScss(), /@keyframes new-animation/);

  editor.mount();
  editor.setData({
    timelines: [
      {
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
      },
    ],
  });

  assert.equal(editor.getData().timelines[0].id, "hero-logo");
  assert.match(editor.toScss(), /@keyframes hero-logo/);
  const idInput = window.document.querySelector("[data-wkf-field='id']");
  assert.equal(idInput?.value, "hero-logo");
});

test("timeline meta inputs update selected timeline data", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setInputValue(window.document, "id", "hero-title");
  setSelectValue(window.document, "translateUnit", "vw");
  setInputValue(window.document, "translateFunctionName", "layout.wrap");
  setNumberValue(window.document, "duration", 1600);

  const data = editor.getData();
  assert.equal(data.timelines[0].id, "hero-title");
  assert.equal(data.timelines[0].translate?.unit, "vw");
  assert.equal(data.timelines[0].translate?.functionName, "layout.wrap");
  assert.equal(data.timelines[0].duration, 1600);
});

test("timeline actions add duplicate and delete timelines", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "add-timeline");
  assert.equal(editor.getData().timelines.length, 2);

  await clickAction(window.document, "duplicate-timeline");
  assert.equal(editor.getData().timelines.length, 3);

  await clickAction(window.document, "delete-timeline");
  assert.equal(editor.getData().timelines.length, 2);
});

test("timeline selection switches the visible editor", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({
    root: window.document.body,
    initialData: {
      timelines: [
        createTimeline("hero-in", 800),
        createTimeline("hero-out", 500),
      ],
    },
  });

  editor.mount();

  const buttons = window.document.querySelectorAll("[data-wkf-action='select-timeline']");
  buttons[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await Promise.resolve();

  const idInput = window.document.querySelector("[data-wkf-field='id']");
  assert.equal(idInput?.value, "hero-out");
  assert.match(editor.toScss(), /@keyframes hero-in/);
  assert.match(editor.toScss(), /@keyframes hero-out/);
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
});

test("keyframe editor updates selected frame values", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setNumberValue(window.document, "time", 300, 1);
  setNumberValue(window.document, "transform-x-0", 24);
  setNumberValue(window.document, "opacity", 0.45);

  const [firstKeyframe] = editor.getData().timelines[0].keyframes;
  assert.equal(firstKeyframe.time, 300);
  assert.equal(firstKeyframe.transforms[0].x, 24);
  assert.equal(firstKeyframe.opacity, 0.45);
});

test("time slider stays mounted while dragging and syncs the numeric field", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  const range = window.document.querySelector("[data-wkf-field='time'][type='range']");
  const number = window.document.querySelector("[data-wkf-field='time'][type='number']");
  range.value = "240";
  range.dispatchEvent(new Event("input", { bubbles: true }));

  assert.equal(editor.getData().timelines[0].keyframes[0].time, 240);
  assert.equal(range.isConnected, true);
  assert.equal(number.isConnected, true);
});

test("sparse keyframe actions can unset opacity and clear transforms", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  clickActionSync(window.document, "unset-opacity");
  assert.equal(window.document.querySelector("[data-wkf-field='opacity']")?.value, "");
  assert.match(editor.toScss(), /0% \{\n    transform: translate\(global\.vw\(0px\), global\.vw\(40px\)\) scale\(1\) rotate\(0deg\);\n  \}/);

  clickActionSync(window.document, "clear-transforms");
  assert.match(window.document.body.textContent ?? "", /None/);
  assert.deepEqual(editor.getData().timelines[0].keyframes[0].transforms, []);

  clickActionSync(window.document, "unset-transforms");
  assert.match(window.document.body.textContent ?? "", /Unset/);
  assert.equal(editor.getData().timelines[0].keyframes[0].transforms, null);
});

test("deleting the last transform sets transform to none", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");

  assert.deepEqual(editor.getData().timelines[0].keyframes[0].transforms, []);
  assert.match(editor.toScss(), /transform: none;/);
});

test("add and delete keyframe actions update the list", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "add-keyframe");
  assert.equal(editor.getData().timelines[0].keyframes.length, 3);

  const keyframeButtons = window.document.querySelectorAll("[data-wkf-action='select-keyframe']");
  keyframeButtons[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  clickActionSync(window.document, "delete-keyframe");

  assert.equal(editor.getData().timelines[0].keyframes.length, 2);
});

test("duplicate keyframe action inserts a copied frame and keeps timeline percentages visible", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  await clickAction(window.document, "duplicate-keyframe");

  const data = editor.getData().timelines[0];
  assert.equal(data.keyframes.length, 3);
  assert.equal(data.keyframes[1].time, 120);
  assert.match(window.document.body.textContent ?? "", /10% of timeline/);
});

test("keyframe list summary reflects translate settings and sparse fields without dangling commas", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();
  setSelectValue(window.document, "translateUnit", "custom");
  setInputValue(window.document, "translateFunctionName", "wkfPx");
  setInputValue(window.document, "translateCustomUnit", "rem");
  setNumberValue(window.document, "transform-x-0", 2);
  setNumberValue(window.document, "transform-y-0", 4);

  const keyframeButtons = window.document.querySelectorAll("[data-wkf-action='select-keyframe']");
  keyframeButtons[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  clickActionSync(window.document, "unset-opacity");
  clickActionSync(window.document, "unset-transforms");

  const summaries = Array.from(window.document.querySelectorAll(".wkf__keyframe-meta")).slice(1).map((node) => node.textContent ?? "");
  assert.match(summaries[0], /translate\(wkfPx\(2rem\), wkfPx\(4rem\)\) scale\(1\) rotate\(0deg\), opacity 0/);
  assert.equal(summaries[1], "");
});

test("copy actions write JSON and SCSS to the clipboard", async () => {
  const { window, clipboardWrites } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "copy-json");
  await clickAction(window.document, "copy-scss");

  assert.match(clipboardWrites[0], /"timelines"/);
  assert.match(clipboardWrites[1], /@keyframes new-animation/);
});

test("preview applies generated keyframes to matching animation-name targets and can be reset", async () => {
  const { window } = createWindow();
  const target = window.document.createElement("div");
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

  await clickAction(window.document, "reset-preview");

  assert.equal(window.document.head.querySelector("style[data-wkf-preview='true']"), null);
  assert.equal(target.style.animationName, "");
});

test("view actions open JSON and SCSS previews and can be closed", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "view-json");
  assert.match(getPreviewValue(window.document), /"timelines"/);

  await clickAction(window.document, "view-scss");
  assert.match(getPreviewValue(window.document), /@keyframes new-animation/);

  await clickAction(window.document, "close-preview");
  assert.equal(getPreviewValue(window.document), "");
});

test("reset restores default document after edits", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({
    root: window.document.body,
    initialData: {
      timelines: [
        createTimeline("hero-in", 800),
        createTimeline("hero-out", 500),
      ],
    },
  });

  editor.mount();
  setInputValue(window.document, "id", "custom-id");
  await clickAction(window.document, "reset");

  const data = editor.getData();
  assert.equal(data.timelines.length, 1);
  assert.equal(data.timelines[0].id, "new-animation");
});

function createTimeline(id, duration) {
  return {
    id,
    duration,
    keyframes: [
      {
        time: 0,
        opacity: 0,
        transforms: [
          { kind: "translate", x: 0, y: 40 },
          { kind: "scale", value: 1 },
          { kind: "rotate", value: 0 },
        ],
      },
      {
        time: duration,
        opacity: 1,
        transforms: [
          { kind: "translate", x: 0, y: 0 },
          { kind: "scale", value: 1 },
          { kind: "rotate", value: 0 },
        ],
      },
    ],
  };
}

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

function getPreviewValue(document) {
  return document.querySelector(".wkf__preview-textarea")?.value ?? "";
}
