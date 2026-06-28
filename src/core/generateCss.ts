import {
  getOpacityProperty,
  getTransformProperty,
  normalizeWebKeyframesDocument,
} from "./normalize.js";
import type {
  NormalizedTranslateConfig,
  NormalizedWebKeyframesTimeline,
  TransformOperation,
  WebKeyframesDocument,
} from "./types.js";

export function generateCss(data: WebKeyframesDocument): string {
  const normalized = normalizeWebKeyframesDocument(data);

  return `${normalized.timelines.map((timeline) => renderTimelineCss(timeline)).join("\n\n")}\n`;
}

function renderTimelineCss(
  normalized: NormalizedWebKeyframesTimeline,
): string {
  const keyframeBlocks = normalized.keyframes.map((keyframe) => {
    const percent = formatPercent(keyframe.percent);
    const lines = [`  ${percent} {`];
    const transformProperty = getTransformProperty(keyframe);
    const opacityProperty = getOpacityProperty(keyframe);
    const timingFunction = keyframe.timingFunction?.trim() ?? "";

    if (transformProperty) {
      lines.push(
        transformProperty.value.length > 0
          ? `    transform: ${transformProperty.value.map((item) => renderTransform(item, normalized.translateConfig)).join(" ")};`
          : "    transform: none;",
      );
    }

    if (opacityProperty && Number.isFinite(opacityProperty.value)) {
      lines.push(`    opacity: ${formatNumber(opacityProperty.value)};`);
    }

    if (timingFunction) {
      lines.push(`    animation-timing-function: ${timingFunction};`);
    }

    lines.push("  }");
    return lines.join("\n");
  });

  return ["@keyframes " + normalized.animationName + " {", ...keyframeBlocks, "}"].join("\n\n");
}

function renderTransform(
  transform: TransformOperation,
  translate: NormalizedTranslateConfig,
): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${renderTranslateValue(transform.x, translate)}, ${renderTranslateValue(transform.y, translate)})`;
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
): string {
  return `${formatNumber(value)}${translateConfig.unit}`;
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
