import { generateCss } from "../core/generateCss.js";
import { normalizeWebKeyframesTimeline } from "../core/normalize.js";
import type { WebKeyframesTimeline } from "../core/types.js";

type StatusTone = "info" | "success" | "error";

export type PreviewPanelState = {
  title: string | null;
  content: string;
};

export type PreviewStatus = {
  tone: StatusTone;
  message: string;
};

type PreviewTargetState = {
  element: HTMLElement;
  inlineAnimationName: string;
};

export type ActivePreview = {
  styleElement: HTMLStyleElement;
  targets: PreviewTargetState[];
};

export type PreviewRunState = {
  activePreview: ActivePreview | null;
  status: PreviewStatus;
};

export function createEmptyPreviewPanelState(): PreviewPanelState {
  return {
    title: null,
    content: "",
  };
}

export function openGeneratedPreviewPanel(
  kind: "json" | "css",
  jsonText: string,
  cssText: string,
): {
  previewPanel: PreviewPanelState;
  status: PreviewStatus;
} {
  const isJson = kind === "json";
  return {
    previewPanel: {
      title: isJson ? "JSON Preview" : "CSS Preview",
      content: isJson ? jsonText : cssText,
    },
    status: {
      tone: "success",
      message: `Opened ${isJson ? "json preview" : "css preview"}.`,
    },
  };
}

export function closePreviewPanel(message: string): {
  previewPanel: PreviewPanelState;
  status: PreviewStatus;
} {
  return {
    previewPanel: createEmptyPreviewPanelState(),
    status: {
      tone: "info",
      message,
    },
  };
}

export function applyPreview(
  ownerDocument: Document,
  timeline: WebKeyframesTimeline,
): ActivePreview {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("Preview is not available in this environment.");
  }

  const normalizedTimeline = normalizeWebKeyframesTimeline(timeline);
  const targets = findPreviewTargets(ownerDocument, normalizedTimeline.id);
  if (targets.length === 0) {
    throw new Error(`No elements using animation-name "${normalizedTimeline.id}" were found.`);
  }

  const previewName = `${normalizedTimeline.id}__wkf_preview`;
  const styleElement = ensurePreviewStyleElement(ownerDocument);
  styleElement.textContent = generatePreviewCssText(timeline, previewName, normalizedTimeline.id);

  const appliedTargets = targets.map((element) => ({
    element,
    inlineAnimationName: element.style.animationName,
  }));

  for (const target of appliedTargets) {
    const computedAnimationName = ownerWindow.getComputedStyle(target.element).animationName;
    const nextAnimationName = replaceAnimationName(computedAnimationName, normalizedTimeline.id, previewName);
    target.element.style.animationName = "none";
    void target.element.offsetWidth;
    target.element.style.animationName = nextAnimationName;
  }

  return {
    styleElement,
    targets: appliedTargets,
  };
}

export function clearAppliedPreview(activePreview: ActivePreview | null): void {
  if (activePreview === null) {
    return;
  }

  for (const target of activePreview.targets) {
    target.element.style.animationName = target.inlineAnimationName;
  }

  activePreview.styleElement.remove();
}

export async function writeClipboardText(windowObject: Window | null, text: string): Promise<void> {
  const clipboard = windowObject?.navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error("Clipboard API is not available.");
  }

  await clipboard.writeText(text);
}

export async function copyGeneratedPayload(
  windowObject: Window | null,
  kind: "json" | "css",
  text: string,
): Promise<PreviewStatus> {
  await writeClipboardText(windowObject, text);
  return {
    tone: "success",
    message: kind === "json" ? "Copied JSON to clipboard." : "Copied CSS to clipboard.",
  };
}

export function runTimelinePreview(
  ownerDocument: Document,
  timeline: WebKeyframesTimeline,
  activePreview: ActivePreview | null,
): PreviewRunState {
  clearAppliedPreview(activePreview);
  const nextActivePreview = applyPreview(ownerDocument, timeline);
  return {
    activePreview: nextActivePreview,
    status: {
      tone: "success",
      message: `Applied preview to ${nextActivePreview.targets.length} element${nextActivePreview.targets.length === 1 ? "" : "s"} for "${timeline.id}".`,
    },
  };
}

export function resetTimelinePreview(activePreview: ActivePreview | null): PreviewRunState {
  if (activePreview === null) {
    return {
      activePreview: null,
      status: {
        tone: "info",
        message: "Preview is not active.",
      },
    };
  }

  clearAppliedPreview(activePreview);
  return {
    activePreview: null,
    status: {
      tone: "success",
      message: "Reset preview.",
    },
  };
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
