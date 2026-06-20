import { WebKeyframesEditor } from "web-keyframes/editor";

const response = await fetch("./src/animations/hero-animation.timeline.json");
const initialData = await response.json();

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
  initialData,
});

editor.mount();

document.querySelector('[data-example-action="toggle-editor"]')?.addEventListener("click", () => {
  editor.toggle();
});
