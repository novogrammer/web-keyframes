export function createEditorContainer(ownerDocument: Document): HTMLElement {
  const container = ownerDocument.createElement("section");
  container.className = "wkf";
  container.setAttribute("aria-hidden", "true");
  return container;
}

export function setContainerVisibility(container: HTMLElement, visible: boolean): void {
  container.classList.toggle("wkf--visible", visible);
  container.setAttribute("aria-hidden", visible ? "false" : "true");
}
