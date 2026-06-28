import { generateCss } from "../../core/generateCss.js";
import { normalizeWebKeyframesTimeline } from "../../core/normalize.js";
import type { WebKeyframesTimeline } from "../../core/types.js";
import { type EditorState, clearPreviewPanel, getSelectedTimeline, setPreviewPanel, setStatus } from "../editorStateController.js";

type PreviewTargetState = {
  element: HTMLElement;
  inlineAnimationName: string;
};

export type ActivePreview = {
  styleElement: HTMLStyleElement;
  targets: PreviewTargetState[];
};

export class EditorPreviewController {
  constructor(
    private readonly root: HTMLElement,
    private readonly state: EditorState,
    private readonly getJson: () => string,
    private readonly getCss: () => string,
  ) {}

  async copyPayload(kind: "json" | "css"): Promise<void> {
    const payload = getPayloadMeta(kind, this.getJson, this.getCss);
    try {
      await writeClipboardText(this.root.ownerDocument.defaultView, payload.text);
      setStatus(this.state, "success", payload.copyMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(this.state, "error", message);
    }
  }

  openGeneratedPreview(kind: "json" | "css"): void {
    const payload = getPayloadMeta(kind, this.getJson, this.getCss);
    try {
      setPreviewPanel(this.state, payload.previewTitle, payload.text);
      setStatus(this.state, "success", payload.openMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      clearPreviewPanel(this.state);
      setStatus(this.state, "error", message);
    }
  }

  closePreview(message: string): void {
    clearPreviewPanel(this.state);
    setStatus(this.state, "info", message);
  }

  runPreview(): void {
    try {
      const timeline = getSelectedTimeline(this.state);
      const animationName = timeline.animationName;
      const ownerDocument = this.root.ownerDocument;
      clearAppliedPreview(this.state.activePreview);
      this.state.activePreview = applyPreview(ownerDocument, timeline);
      setStatus(
        this.state,
        "success",
        `Applied preview to ${this.state.activePreview.targets.length} element${this.state.activePreview.targets.length === 1 ? "" : "s"} for "${animationName}".`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(this.state, "error", message);
    }
  }

  resetAppliedPreview(): void {
    if (this.state.activePreview === null) {
      setStatus(this.state, "info", "Preview is not active.");
      return;
    }

    clearAppliedPreview(this.state.activePreview);
    this.state.activePreview = null;
    setStatus(this.state, "success", "Reset preview.");
  }

  disposeAppliedPreview(): void {
    clearAppliedPreview(this.state.activePreview);
    this.state.activePreview = null;
  }
}

function applyPreview(
  ownerDocument: Document,
  timeline: WebKeyframesTimeline,
): ActivePreview {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("Preview is not available in this environment.");
  }

  const normalizedTimeline = normalizeWebKeyframesTimeline(timeline);
  const targets = findPreviewTargets(ownerDocument, normalizedTimeline.animationName);
  if (targets.length === 0) {
    throw new Error(`No elements using animation-name "${normalizedTimeline.animationName}" were found.`);
  }

  const previewName = `${normalizedTimeline.animationName}__wkf_preview`;
  const styleElement = ensurePreviewStyleElement(ownerDocument);
  styleElement.textContent = generatePreviewCssText(timeline, previewName, normalizedTimeline.animationName);

  const appliedTargets = targets.map((element) => ({
    element,
    inlineAnimationName: element.style.animationName,
  }));

  for (const target of appliedTargets) {
    const computedAnimationName = ownerWindow.getComputedStyle(target.element).animationName;
    const nextAnimationName = replaceAnimationName(computedAnimationName, normalizedTimeline.animationName, previewName);
    target.element.style.animationName = "none";
    void target.element.offsetWidth;
    target.element.style.animationName = nextAnimationName;
  }

  return {
    styleElement,
    targets: appliedTargets,
  };
}

function clearAppliedPreview(activePreview: ActivePreview | null): void {
  if (activePreview === null) {
    return;
  }

  for (const target of activePreview.targets) {
    target.element.style.animationName = target.inlineAnimationName;
  }

  activePreview.styleElement.remove();
}

function ensurePreviewStyleElement(ownerDocument: Document): HTMLStyleElement {
  const existing = ownerDocument.head.querySelector<HTMLStyleElement>("style[data-wkf-preview='true']");
  if (existing) {
    return existing;
  }

  const styleElement = ownerDocument.createElement("style");
  styleElement.dataset.wkfPreview = "true";
  ownerDocument.head.append(styleElement);
  return styleElement;
}

function findPreviewTargets(ownerDocument: Document, animationName: string): HTMLElement[] {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    return [];
  }

  return Array.from(ownerDocument.querySelectorAll<HTMLElement>("body *")).filter((element) => {
    const names = ownerWindow.getComputedStyle(element).animationName;
    return splitAnimationNames(names).includes(animationName);
  });
}

function splitAnimationNames(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "none");
}

function replaceAnimationName(value: string, currentName: string, nextName: string): string {
  const names = splitAnimationNames(value);
  if (names.length === 0) {
    return nextName;
  }

  return names.map((name) => (name === currentName ? nextName : name)).join(", ");
}

function generatePreviewCssText(timeline: WebKeyframesTimeline, previewName: string, currentName: string): string {
  const css = generateCss({ timelines: [timeline] });
  if (previewName === currentName) {
    return css;
  }

  return css.replace(/^@keyframes\s+[^\s{]+\s+\{/, `@keyframes ${previewName} {`);
}

async function writeClipboardText(windowObject: Window | null, text: string): Promise<void> {
  const clipboard = windowObject?.navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error("Clipboard API is not available.");
  }

  await clipboard.writeText(text);
}

function getPayloadMeta(
  kind: "json" | "css",
  getJson: () => string,
  getCss: () => string,
): {
  text: string;
  previewTitle: string;
  copyMessage: string;
  openMessage: string;
} {
  if (kind === "json") {
    return {
      text: getJson(),
      previewTitle: "JSON Preview",
      copyMessage: "Copied JSON to clipboard.",
      openMessage: "Opened json preview.",
    };
  }

  return {
    text: getCss(),
    previewTitle: "CSS Preview",
    copyMessage: "Copied CSS to clipboard.",
    openMessage: "Opened css preview.",
  };
}
