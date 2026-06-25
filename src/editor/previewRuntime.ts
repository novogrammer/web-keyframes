import { generatePreviewCss, normalizeWebKeyframesTimeline } from "../core/index.js";
import type { WebKeyframesTimeline } from "../core/index.js";

type PreviewTargetState = {
  element: HTMLElement;
  inlineAnimationName: string;
};

export type ActivePreview = {
  keyframesName: string;
  styleElement: HTMLStyleElement;
  targets: PreviewTargetState[];
};

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
  styleElement.textContent = generatePreviewCss(timeline, previewName);

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
    keyframesName: previewName,
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
