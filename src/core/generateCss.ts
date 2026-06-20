import { formatCss } from "./formatCss.js";
import {
  getOpacityProperty,
  getTransformProperty,
  normalizeWebKeyframesDocument,
  normalizeWebKeyframesTimeline,
} from "./normalize.js";
import { validateWebKeyframesDocument, validateWebKeyframesTimeline } from "./validate.js";
import type {
  NormalizedTranslateConfig,
  TransformOperation,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "./types.js";

export function generateCss(data: WebKeyframesDocument): string {
  const validated = validateWebKeyframesDocument(data);
  const normalized = normalizeWebKeyframesDocument(data);

  return formatCss(
    validated.timelines.map((timeline, index) => renderTimelineCss(timeline, normalized.timelines[index])),
  );
}

export function generateTimelineCss(data: WebKeyframesTimeline): string {
  const validated = validateWebKeyframesTimeline(data);
  const normalized = normalizeWebKeyframesTimeline(data);
  return formatCss([renderTimelineCss(validated, normalized)]);
}

function renderTimelineCss(
  validated: WebKeyframesTimeline,
  normalized: ReturnType<typeof normalizeWebKeyframesTimeline>,
): string {
  const keyframesByTime = [...validated.keyframes].sort((left, right) => left.time - right.time);

  const keyframeBlocks = keyframesByTime.map((keyframe, index) => {
    const percent = formatPercent((normalized.keyframes[index].time / normalized.duration) * 100);
    const lines = [`  ${percent} {`];
    const transformProperty = getTransformProperty(keyframe);
    const opacityProperty = getOpacityProperty(keyframe);

    if (transformProperty) {
      lines.push(
        transformProperty.value.length > 0
          ? `    transform: ${transformProperty.value.map((item) => renderTransform(item, normalized.translateConfig, false)).join(" ")};`
          : "    transform: none;",
      );
    }

    if (opacityProperty && Number.isFinite(opacityProperty.value)) {
      lines.push(`    opacity: ${formatNumber(opacityProperty.value)};`);
    }

    lines.push("  }");
    return lines.join("\n");
  });

  return ["@keyframes " + normalized.id + " {", ...keyframeBlocks, "}"].join("\n\n");
}

export function renderTransform(
  transform: TransformOperation,
  translate: NormalizedTranslateConfig,
  previewMode: boolean,
): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${renderTranslateValue(transform.x, translate, previewMode)}, ${renderTranslateValue(transform.y, translate, previewMode)})`;
    case "scale":
      return `scale(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function renderTranslateValue(
  value: number,
  translateConfig: NormalizedTranslateConfig,
  previewMode: boolean,
): string {
  const unit = translateConfig.unit === "custom" ? translateConfig.customUnit ?? "px" : translateConfig.unit;
  void previewMode;
  return `${formatNumber(value)}${unit}`;
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}
