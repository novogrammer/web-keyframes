import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  createOpacityProperty,
  createTransformProperty,
  getOpacityValue,
  getTransformOperations,
} from "../dist/index.js";
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
  assert.match(editor.toCss(), /@keyframes new-animation/);

  editor.mount();
  editor.setData({
    timelines: [
      {
        id: "hero-logo",
        duration: 900,
        keyframes: [
          createKeyframe(0, 0, [
            { kind: "translate", x: 0, y: 20 },
            { kind: "scale", x: 1, y: 1 },
            { kind: "rotate", value: 0 },
          ]),
          createKeyframe(900, 1, [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", x: 1, y: 1 },
            { kind: "rotate", value: 0 },
          ]),
        ],
      },
    ],
  });

  assert.equal(editor.getData().timelines[0].id, "hero-logo");
  assert.match(editor.toCss(), /@keyframes hero-logo/);
  const idInput = window.document.querySelector("[data-wkf-field='id']");
  assert.equal(idInput?.value, "hero-logo");
});

test("timeline meta inputs update selected timeline data", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  setInputValue(window.document, "id", "hero-title");
  setSelectValue(window.document, "translateUnit", "vw");
  setNumberValue(window.document, "duration", 1600);

  const data = editor.getData();
  assert.equal(data.timelines[0].id, "hero-title");
  assert.equal(data.timelines[0].translateConfig?.unit, "vw");
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
  assert.match(editor.toCss(), /@keyframes hero-in/);
  assert.match(editor.toCss(), /@keyframes hero-out/);
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

test("sparse initialData round-trips through getData and toJson without densifying keyframes", () => {
  const { window } = createWindow();
  const initialData = {
    timelines: [
      {
        id: "hero-title-intro",
        duration: 3000,
        translateConfig: { unit: "%" },
        keyframes: [
          {
            time: 0,
            properties: [createOpacityProperty(0)],
          },
          {
            time: 1500,
            timingFunction: "ease-out",
          },
          {
            time: 2000,
            properties: [createTransformProperty([{ kind: "scale", x: 1, y: 1 }])],
          },
        ],
      },
    ],
  };
  const editor = new WebKeyframesEditor({
    root: window.document.body,
    initialData,
  });

  editor.mount();

  assert.deepEqual(editor.getData(), initialData);
  assert.deepEqual(JSON.parse(editor.toJson()), initialData);
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
  assert.equal(getTransformOperations(firstKeyframe)[0].x, 24);
  assert.equal(getOpacityValue(firstKeyframe), 0.45);
});

test("timingFunction editor supports preset buttons and custom text", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "set-timing-function", 4);
  assert.equal(editor.getData().timelines[0].keyframes[0].timingFunction, "ease-in-out");

  setInputValue(window.document, "timingFunction", "cubic-bezier(0.2, 0.8, 0.2, 1)");
  assert.equal(editor.getData().timelines[0].keyframes[0].timingFunction, "cubic-bezier(0.2, 0.8, 0.2, 1)");

  await clickAction(window.document, "clear-timing-function");
  assert.equal(editor.getData().timelines[0].keyframes[0].timingFunction, undefined);
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

  clickActionSync(window.document, "delete-opacity");
  assert.equal(window.document.querySelector("[data-wkf-field='opacity']"), null);
  assert.match(window.document.body.textContent ?? "", /\+ Opacity/);
  assert.match(editor.toCss(), /0% \{\n    transform: translate\(0px, 40px\) scale\(1, 1\) rotate\(0deg\);\n  \}/);

  clickActionSync(window.document, "add-opacity");
  assert.equal(window.document.querySelector("[data-wkf-field='opacity']")?.value, "1");
  assert.equal(getOpacityValue(editor.getData().timelines[0].keyframes[0]), 1);

  clickActionSync(window.document, "clear-transforms");
  assert.match(window.document.body.textContent ?? "", /None/);
  assert.deepEqual(getTransformOperations(editor.getData().timelines[0].keyframes[0]), []);

  clickActionSync(window.document, "delete-transforms");
  assert.doesNotMatch(window.document.body.textContent ?? "", /Transforms/);
  assert.equal(editor.getData().timelines[0].keyframes[0].properties?.some((property) => property.kind === "transform"), false);
});

test("unset properties can be added again from the keyframe editor", () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  clickActionSync(window.document, "delete-opacity");
  clickActionSync(window.document, "delete-transforms");
  clickActionSync(window.document, "add-opacity");
  clickActionSync(window.document, "add-transform");

  const keyframe = editor.getData().timelines[0].keyframes[0];
  assert.equal(getOpacityValue(keyframe), 1);
  assert.deepEqual(getTransformOperations(keyframe), [{ kind: "translate", x: 0, y: 0 }]);
  assert.equal(window.document.querySelector("[data-wkf-field='opacity']")?.value, "1");
  assert.equal(window.document.querySelectorAll("[data-wkf-action='delete-transform']").length, 1);
});

test("deleting the last transform sets transform to none", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");
  await clickAction(window.document, "delete-transform");

  assert.deepEqual(getTransformOperations(editor.getData().timelines[0].keyframes[0]), []);
  assert.match(editor.toCss(), /transform: none;/);
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
  setInputValue(window.document, "translateCustomUnit", "rem");
  setNumberValue(window.document, "transform-x-0", 2);
  setNumberValue(window.document, "transform-y-0", 4);
  setInputValue(window.document, "timingFunction", "ease-out");

  const keyframeButtons = window.document.querySelectorAll("[data-wkf-action='select-keyframe']");
  keyframeButtons[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  clickActionSync(window.document, "delete-opacity");
  clickActionSync(window.document, "delete-transforms");

  const summaries = Array.from(window.document.querySelectorAll(".wkf__keyframe-meta")).slice(1).map((node) => node.textContent ?? "");
  assert.match(summaries[0], /translate\(2rem, 4rem\) scale\(1, 1\) rotate\(0deg\), opacity 0, timingFunction ease-out/);
  assert.equal(summaries[1], "");
});

test("copy actions write JSON and CSS to the clipboard", async () => {
  const { window, clipboardWrites } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "copy-json");
  await clickAction(window.document, "copy-css");

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

test("view actions open JSON and CSS previews and can be closed", async () => {
  const { window } = createWindow();
  const editor = new WebKeyframesEditor({ root: window.document.body });

  editor.mount();

  await clickAction(window.document, "view-json");
  assert.match(getPreviewValue(window.document), /"timelines"/);

  await clickAction(window.document, "view-css");
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
      createKeyframe(0, 0, [
        { kind: "translate", x: 0, y: 40 },
        { kind: "scale", x: 1, y: 1 },
        { kind: "rotate", value: 0 },
      ]),
      createKeyframe(duration, 1, [
        { kind: "translate", x: 0, y: 0 },
        { kind: "scale", x: 1, y: 1 },
        { kind: "rotate", value: 0 },
      ]),
    ],
  };
}

function createKeyframe(time, opacity, transforms) {
  const properties = [];
  if (opacity !== undefined) {
    properties.push(createOpacityProperty(opacity));
  }
  if (transforms !== undefined) {
    properties.push(createTransformProperty(transforms));
  }

  return { time, properties };
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

function clickActionSync(document, action, index = 0) {
  const buttons = document.querySelectorAll(`[data-wkf-action='${action}']`);
  const button = buttons[index];
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function clickAction(document, action, index = 0) {
  const buttons = document.querySelectorAll(`[data-wkf-action='${action}']`);
  const button = buttons[index];
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

function getPreviewValue(document) {
  return document.querySelector(".wkf__preview-textarea")?.value ?? "";
}
