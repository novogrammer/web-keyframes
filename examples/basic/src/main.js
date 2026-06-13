import { WebKeyframesEditor } from "web-keyframes/editor";

const initialData = {
  id: "hero-logo",
  duration: 1200,
  translate: { unit: "px", functionName: "wkf-px" },
  keyframes: [
    { time: 0, x: 0, y: 40, scale: 0.88, rotate: -6, opacity: 0 },
    { time: 700, x: 0, y: -8, scale: 1.04, rotate: 2, opacity: 1 },
    { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
  ]
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
