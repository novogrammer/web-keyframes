import { generateCss } from "../core/generateCss.js";
import { normalizeWebKeyframesTimeline } from "../core/normalize.js";
import type { WebKeyframesTimeline } from "../core/types.js";
import type { ActivePreview, EditorState, FocusSnapshot, PanelPosition } from "./editorCore.js";
import { getSelectedTimeline, setStatus } from "./editorCore.js";
import { createEditorContainer, setContainerVisibility } from "./editorShell.js";

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

type Shortcut = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

type DomOptions = {
  shortcut: string | false | undefined;
  getJson: () => string;
  getCss: () => string;
  onToggle: () => void;
  onEscape: () => void;
  onClick: (event: MouseEvent) => void;
  onInput: (event: Event) => void;
  onChange: (event: Event) => void;
};

export class EditorDomController {
  private readonly shortcut: Shortcut | null;
  private dragOffset: { x: number; y: number } | null = null;
  private container: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState,
    private readonly options: DomOptions,
  ) {
    this.shortcut = parseShortcut(options.shortcut);
  }

  createContainer(): HTMLElement {
    return createEditorContainer(this.root.ownerDocument);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    bindContainerEvents(container, this.options, "addEventListener");
    this.root.ownerDocument.addEventListener("keydown", this.handleKeydown);
  }

  unmount(): void {
    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
    if (this.container) {
      bindContainerEvents(this.container, this.options, "removeEventListener");
    }
    this.endDrag();
    this.container = null;
  }

  show(container: HTMLElement): void {
    setContainerVisibility(container, true);
  }

  hide(container: HTMLElement): void {
    setContainerVisibility(container, false);
  }

  toggle(container: HTMLElement): void {
    setContainerVisibility(container, !container.classList.contains("wkf--visible"));
  }

  syncPanel(container: HTMLElement | null, position: PanelPosition | null): void {
    const panel = container?.querySelector<HTMLElement>(".wkf__panel");
    if (!panel) {
      return;
    }
    for (const handle of container.querySelectorAll<HTMLElement>("[data-wkf-drag-handle='true']")) {
      handle.onmousedown = (event) => this.startDrag(event, container);
    }
    if (position === null) {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.bottom = "";
      panel.style.transform = "";
      return;
    }
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  restoreFocus(container: HTMLElement | null, pendingFocus: FocusSnapshot | null, clear: () => void): void {
    if (!container || !pendingFocus) {
      return;
    }
    const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${pendingFocus.field}']`);
    const input = inputs[pendingFocus.index];
    if (!input) {
      clear();
      return;
    }
    input.focus();
    if (input instanceof HTMLInputElement && pendingFocus.selectionStart !== null && pendingFocus.selectionEnd !== null) {
      input.setSelectionRange(pendingFocus.selectionStart, pendingFocus.selectionEnd);
    }
    clear();
  }

  captureFocusSnapshot(container: HTMLElement | null, field: string, input: HTMLInputElement | HTMLSelectElement): FocusSnapshot {
    const inputs = container?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`) ?? [];
    return {
      field,
      index: Math.max(0, Array.from(inputs).indexOf(input)),
      selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
      selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
    };
  }

  syncNumberFieldValues(container: HTMLElement | null, field: string, value: number, source: HTMLInputElement): void {
    for (const input of container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`) ?? []) {
      if (input !== source) {
        input.value = String(value);
      }
    }
  }

  async copyPayload(kind: "json" | "css"): Promise<void> {
    const payload = getPayload(kind, this.options.getJson, this.options.getCss);
    try {
      const clipboard = this.root.ownerDocument.defaultView?.navigator?.clipboard;
      if (!clipboard?.writeText) {
        throw new Error("Clipboard API is not available.");
      }
      await clipboard.writeText(payload.text);
      setStatus(this.state, "success", payload.copyMessage);
    } catch (error) {
      setStatus(this.state, "error", error instanceof Error ? error.message : String(error));
    }
  }

  openPreview(kind: "json" | "css"): void {
    const payload = getPayload(kind, this.options.getJson, this.options.getCss);
    this.state.previewTitle = payload.previewTitle;
    this.state.previewContent = payload.text;
    setStatus(this.state, "success", payload.openMessage);
  }

  closePreview(message: string): void {
    this.state.previewTitle = null;
    this.state.previewContent = "";
    setStatus(this.state, "info", message);
  }

  runPreview(): void {
    try {
      const timeline = getSelectedTimeline(this.state);
      clearPreview(this.state.activePreview);
      this.state.activePreview = applyPreview(this.root.ownerDocument, timeline);
      setStatus(
        this.state,
        "success",
        `Applied preview to ${this.state.activePreview.targets.length} element${this.state.activePreview.targets.length === 1 ? "" : "s"} for "${timeline.animationName}".`,
      );
    } catch (error) {
      setStatus(this.state, "error", error instanceof Error ? error.message : String(error));
    }
  }

  resetAppliedPreview(): void {
    if (this.state.activePreview === null) {
      setStatus(this.state, "info", "Preview is not active.");
      return;
    }
    clearPreview(this.state.activePreview);
    this.state.activePreview = null;
    setStatus(this.state, "success", "Reset preview.");
  }

  disposeAppliedPreview(): void {
    clearPreview(this.state.activePreview);
    this.state.activePreview = null;
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.options.onEscape();
      return;
    }
    if (this.shortcut && matchesShortcut(event, this.shortcut)) {
      event.preventDefault();
      this.options.onToggle();
    }
  };

  private startDrag(event: MouseEvent, container: HTMLElement): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("[data-wkf-no-drag='true'], button, input, select, textarea, label")) {
      return;
    }
    const panel = container.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    this.state.panelPosition = { left: rect.left, top: rect.top };
    this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.container = container;
    panel.classList.add("wkf__panel--dragging");
    ownerWindow.addEventListener("mousemove", this.moveDrag);
    ownerWindow.addEventListener("mouseup", this.endDrag);
    event.preventDefault();
  }

  private readonly moveDrag = (event: MouseEvent): void => {
    if (!this.dragOffset || !this.container) {
      return;
    }
    const panel = this.container.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    this.state.panelPosition = {
      left: clampNumber(event.clientX - this.dragOffset.x, Math.min(0, PANEL_MIN_VISIBLE_X - rect.width), Math.max(0, ownerWindow.innerWidth - PANEL_MIN_VISIBLE_X)),
      top: clampNumber(event.clientY - this.dragOffset.y, Math.min(0, PANEL_MIN_VISIBLE_Y - rect.height), Math.max(0, ownerWindow.innerHeight - PANEL_MIN_VISIBLE_Y)),
    };
    this.syncPanel(this.container, this.state.panelPosition);
  };

  private readonly endDrag = (): void => {
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", this.moveDrag);
      ownerWindow.removeEventListener("mouseup", this.endDrag);
    }
    this.container?.querySelector<HTMLElement>(".wkf__panel")?.classList.remove("wkf__panel--dragging");
    this.dragOffset = null;
  };
}

function bindContainerEvents(
  container: HTMLElement,
  options: Pick<DomOptions, "onClick" | "onInput" | "onChange">,
  method: "addEventListener" | "removeEventListener",
): void {
  container[method]("click", options.onClick);
  container[method]("input", options.onInput);
  container[method]("change", options.onChange);
}

function applyPreview(ownerDocument: Document, timeline: WebKeyframesTimeline): ActivePreview {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("Preview is not available in this environment.");
  }
  const normalized = normalizeWebKeyframesTimeline(timeline);
  const targets = Array.from(ownerDocument.querySelectorAll<HTMLElement>("body *")).filter((element) =>
    ownerWindow.getComputedStyle(element).animationName.split(",").map((part) => part.trim()).includes(normalized.animationName)
  );
  if (!targets.length) {
    throw new Error(`No elements using animation-name "${normalized.animationName}" were found.`);
  }
  const previewName = `${normalized.animationName}__wkf_preview`;
  const styleElement = ownerDocument.head.querySelector<HTMLStyleElement>("style[data-wkf-preview='true']") ?? ownerDocument.createElement("style");
  styleElement.dataset.wkfPreview = "true";
  styleElement.textContent = generateCss({ timelines: [timeline] }).replace(/^@keyframes\s+[^\s{]+\s+\{/, `@keyframes ${previewName} {`);
  if (!styleElement.parentElement) {
    ownerDocument.head.append(styleElement);
  }
  const applied = targets.map((element) => ({ element, inlineAnimationName: element.style.animationName }));
  for (const target of applied) {
    const computed = ownerWindow.getComputedStyle(target.element).animationName;
    const names = computed.split(",").map((part) => part.trim()).filter((part) => part && part !== "none");
    target.element.style.animationName = "none";
    void target.element.offsetWidth;
    target.element.style.animationName = (names.length ? names : [normalized.animationName]).map((name) => name === normalized.animationName ? previewName : name).join(", ");
  }
  return { styleElement, targets: applied };
}

function clearPreview(activePreview: ActivePreview | null): void {
  if (!activePreview) {
    return;
  }
  for (const target of activePreview.targets) {
    target.element.style.animationName = target.inlineAnimationName;
  }
  activePreview.styleElement.remove();
}

function getPayload(kind: "json" | "css", getJson: () => string, getCss: () => string) {
  return kind === "json"
    ? { text: getJson(), previewTitle: "JSON Preview", copyMessage: "Copied JSON to clipboard.", openMessage: "Opened json preview." }
    : { text: getCss(), previewTitle: "CSS Preview", copyMessage: "Copied CSS to clipboard.", openMessage: "Opened css preview." };
}

function parseShortcut(shortcut: string | false | undefined): Shortcut | null {
  if (!shortcut || typeof shortcut !== "string") {
    return null;
  }
  const parts = shortcut.toLowerCase().split("+").map((part) => part.trim()).filter(Boolean);
  const key = parts.pop();
  return !key
    ? null
    : { key, ctrlKey: parts.includes("ctrl"), metaKey: parts.includes("meta") || parts.includes("cmd"), shiftKey: parts.includes("shift"), altKey: parts.includes("alt") || parts.includes("option") };
}

function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  return event.key.toLowerCase() === shortcut.key
    && event.ctrlKey === shortcut.ctrlKey
    && event.metaKey === shortcut.metaKey
    && event.shiftKey === shortcut.shiftKey
    && event.altKey === shortcut.altKey;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
