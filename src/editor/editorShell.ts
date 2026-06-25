export function createEditorContainer(ownerDocument: Document): HTMLElement {
  const container = ownerDocument.createElement("section");
  container.className = "wkf";
  setEditorVisibility(container, false);
  return container;
}

export function setEditorVisibility(container: HTMLElement, isVisible: boolean): void {
  container.classList.toggle("wkf--visible", isVisible);
  container.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

export function isEditorVisible(container: HTMLElement): boolean {
  return container.classList.contains("wkf--visible");
}
