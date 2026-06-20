import { WebKeyframesEditor } from "web-keyframes/editor";

await setupEditor(document.body);

async function setupEditor(root) {
  const response = await fetch("./animations/hero-animation.timeline.json");
  const initialData = await response.json();

  const editor = new WebKeyframesEditor({
    root,
    shortcut: "Ctrl+Shift+K",
    initialData,
  });

  editor.mount();

  document.querySelector('[data-example-action="toggle-editor"]')?.addEventListener("click", () => {
    editor.toggle();
  });

  return editor;
}
