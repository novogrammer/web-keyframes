import { h, render } from "preact";

import { generateCss } from "../core/generateCss.js";
import { cloneDocument, normalizeWebKeyframesTimeline } from "../core/normalize.js";
import type { TransformKind, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import { validateWebKeyframesDocument } from "../core/validate.js";
import { EditorApp } from "./EditorApp.js";
import {
  createDefaultEditorDocument,
  createEditorState,
  dispatchEditorAction,
  getSelectedTimeline,
  normalizeEditorState,
  setStatus,
  syncSelectionWithData,
  type ActivePreview,
  type EditorAction,
  type EditorState,
  type FocusSnapshot,
} from "./editorCore.js";
import { createEditorContainer, setContainerVisibility } from "./editorShell.js";

type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
};

type Shortcut = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly initialData: WebKeyframesDocument;
  private readonly state: EditorState;
  private readonly shortcut: Shortcut | null;
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.state.previewTitle !== null) {
        this.closePreview("Closed preview.");
      }
      return;
    }
    if (this.shortcut && matchesShortcut(event, this.shortcut)) {
      event.preventDefault();
      this.toggle();
    }
  };
  private readonly handleDragMove = (event: MouseEvent): void => {
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
    this.applyPanelPosition();
  };
  private readonly handleDragEnd = (): void => {
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", this.handleDragMove);
      ownerWindow.removeEventListener("mouseup", this.handleDragEnd);
    }
    this.container?.querySelector<HTMLElement>(".wkf__panel")?.classList.remove("wkf__panel--dragging");
    this.dragOffset = null;
  };
  private container: HTMLElement | null = null;
  private mounted = false;
  private dragOffset: { x: number; y: number } | null = null;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }
    this.root = options.root;
    this.initialData = options.initialData ? validateAndCloneEditorData(options.initialData) : createDefaultEditorDocument();
    this.state = createEditorState(this.initialData);
    this.shortcut = parseShortcut(options.shortcut);
  }

  mount(): void {
    if (this.mounted) {
      throw new Error("mount() has already been called.");
    }
    this.container = createEditorContainer(this.root.ownerDocument);
    this.root.ownerDocument.addEventListener("keydown", this.handleKeydown);
    this.render();
    this.root.append(this.container);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }
    this.disposeAppliedPreview();
    this.handleDragEnd();
    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
    if (this.container) {
      render(null, this.container);
      this.container.remove();
    }
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    setContainerVisibility(this.container!, true);
  }

  hide(): void {
    this.ensureMounted();
    setContainerVisibility(this.container!, false);
  }

  toggle(): void {
    this.ensureMounted();
    setContainerVisibility(this.container!, !this.container!.classList.contains("wkf--visible"));
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.state.data);
  }

  setData(data: WebKeyframesDocument): void {
    this.state.data = validateAndCloneEditorData(data);
    normalizeEditorState(this.state);
    this.render();
  }

  toJson(): string {
    return JSON.stringify(cloneDocument(this.state.data), null, 2);
  }

  toCss(): string {
    return generateCss(this.state.data);
  }

  private ensureMounted(): void {
    if (!this.mounted || this.container === null) {
      throw new Error("Editor is not mounted.");
    }
  }

  private render(): void {
    if (!this.container) {
      return;
    }
    syncSelectionWithData(this.state);
    render(
      h(EditorApp, {
        state: this.state,
        apply: (action) => this.apply(action),
        reset: () => this.reset(),
        hide: () => this.hide(),
        copyPayload: (kind) => { void this.copyPayload(kind); },
        openPreview: (kind) => this.openPreview(kind),
        closePreview: () => this.closePreview("Closed preview."),
        runPreview: () => this.runPreviewAndRender(),
        resetPreview: () => this.resetPreviewAndRender(),
        onDragStart: (event) => this.startDrag(event),
      }),
      this.container,
    );
    this.applyPanelPosition();
    queueMicrotask(() => this.restoreFocus());
  }

  private apply(action: EditorAction): void {
    if (dispatchEditorAction(this.state, action)) {
      this.render();
    }
  }

  private reset(): void {
    this.disposeAppliedPreview();
    this.apply({ type: "reset", initialData: this.initialData });
  }

  private async copyPayload(kind: "json" | "css"): Promise<void> {
    const payload = getPayload(kind, () => this.toJson(), () => this.toCss());
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
    this.render();
  }

  private openPreview(kind: "json" | "css"): void {
    const payload = getPayload(kind, () => this.toJson(), () => this.toCss());
    this.state.previewTitle = payload.previewTitle;
    this.state.previewContent = payload.text;
    setStatus(this.state, "success", payload.openMessage);
    this.render();
  }

  private closePreview(message: string): void {
    this.state.previewTitle = null;
    this.state.previewContent = "";
    setStatus(this.state, "info", message);
    this.render();
  }

  private runPreview(): void {
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

  private runPreviewAndRender(): void {
    this.runPreview();
    this.render();
  }

  private resetAppliedPreview(): void {
    if (this.state.activePreview === null) {
      setStatus(this.state, "info", "Preview is not active.");
      return;
    }
    clearPreview(this.state.activePreview);
    this.state.activePreview = null;
    setStatus(this.state, "success", "Reset preview.");
  }

  private resetPreviewAndRender(): void {
    this.resetAppliedPreview();
    this.render();
  }

  private disposeAppliedPreview(): void {
    clearPreview(this.state.activePreview);
    this.state.activePreview = null;
  }

  private startDrag(event: MouseEvent): void {
    if (event.button !== 0 || !this.container) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest("[data-wkf-no-drag='true'], button, input, select, textarea, label")) {
      return;
    }
    const panel = this.container.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    this.state.panelPosition = { left: rect.left, top: rect.top };
    this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    panel.classList.add("wkf__panel--dragging");
    ownerWindow.addEventListener("mousemove", this.handleDragMove);
    ownerWindow.addEventListener("mouseup", this.handleDragEnd);
    event.preventDefault();
  }

  private applyPanelPosition(): void {
    const panel = this.container?.querySelector<HTMLElement>(".wkf__panel");
    if (!panel) {
      return;
    }
    const position = this.state.panelPosition;
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

  private restoreFocus(): void {
    if (!this.container || !this.state.pendingFocus) {
      return;
    }
    const pending = this.state.pendingFocus;
    const inputs = this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${pending.field}']`);
    const input = inputs[pending.index];
    if (!input) {
      this.state.pendingFocus = null;
      return;
    }
    input.focus();
    if (input instanceof HTMLInputElement && pending.selectionStart !== null && pending.selectionEnd !== null) {
      input.setSelectionRange(pending.selectionStart, pending.selectionEnd);
    }
    this.state.pendingFocus = null;
  }
}

function validateAndCloneEditorData(data: WebKeyframesDocument): WebKeyframesDocument {
  return cloneDocument(validateWebKeyframesDocument(data));
}

function getPayload(kind: "json" | "css", getJson: () => string, getCss: () => string) {
  return kind === "json"
    ? { text: getJson(), previewTitle: "JSON Preview", copyMessage: "Copied JSON to clipboard.", openMessage: "Opened json preview." }
    : { text: getCss(), previewTitle: "CSS Preview", copyMessage: "Copied CSS to clipboard.", openMessage: "Opened css preview." };
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
