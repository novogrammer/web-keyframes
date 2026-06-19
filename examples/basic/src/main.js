import { WebKeyframesEditor } from "web-keyframes/editor";

const initialData = {
  timelines: [
    {
      id: "hero-logo-intro",
      duration: 1200,
      translate: { unit: "px", functionName: "wkf-px" },
      keyframes: [
        {
          time: 0,
          opacity: 0,
          transforms: [
            { kind: "translate", x: 0, y: 40 },
            { kind: "scale", value: 0.88 },
            { kind: "rotate", value: -6 },
          ],
        },
        {
          time: 700,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: -8 },
            { kind: "scale", value: 1.04 },
            { kind: "rotate", value: 2 },
          ],
        },
        {
          time: 1200,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", value: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
      ],
    },
    {
      id: "hero-logo-idle",
      duration: 2000,
      translate: { unit: "px", functionName: "wkf-px" },
      keyframes: [
        {
          time: 0,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", value: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
        {
          time: 1000,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: -2 },
            { kind: "scale", value: 1.01 },
            { kind: "rotate", value: 1 },
          ],
        },
        {
          time: 2000,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", value: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
      ],
    },
    {
      id: "hero-badge-intro",
      duration: 900,
      translate: { unit: "px", functionName: "wkf-px" },
      keyframes: [
        {
          time: 0,
          opacity: 0,
          transforms: [
            { kind: "translate", x: -28, y: 10 },
            { kind: "scale", value: 0.92 },
            { kind: "rotate", value: -10 },
          ],
        },
        {
          time: 520,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 4, y: -2 },
            { kind: "scale", value: 1.03 },
            { kind: "rotate", value: 2 },
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
    {
      id: "hero-badge-idle",
      duration: 1800,
      translate: { unit: "px", functionName: "wkf-px" },
      keyframes: [
        {
          time: 0,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", value: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
        {
          time: 900,
          opacity: 1,
          transforms: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", value: 1.06 },
            { kind: "rotate", value: -3 },
          ],
        },
        {
          time: 1800,
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
};

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
  initialData
});

editor.mount();

document.querySelector('[data-example-action="toggle-editor"]')?.addEventListener("click", () => {
  editor.toggle();
});
