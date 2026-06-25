import { formatCss } from "./formatCss.js";
import {
  getKeyframePositionValue,
  getOpacityProperty,
  getTimelinePositionType,
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

function renderTimelineCss(
  validated: WebKeyframesTimeline,
  normalized: ReturnType<typeof normalizeWebKeyframesTimeline>,
): string {
  const positionType = getTimelinePositionType(validated);
  const keyframesByTime = [...validated.keyframes].sort(
    (left, right) => getKeyframePositionValue(left, positionType) - getKeyframePositionValue(right, positionType),
  );

  const keyframeBlocks = keyframesByTime.map((keyframe, index) => {
    const percent = formatPercent(normalized.keyframes[index].percent);
    const lines = [`  ${percent} {`];
    const transformProperty = getTransformProperty(keyframe);
    const opacityProperty = getOpacityProperty(keyframe);
    const timingFunction = typeof keyframe.timingFunction === "string" ? keyframe.timingFunction.trim() : "";

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

  return ["@keyframes " + normalized.id + " {", ...keyframeBlocks, "}"].join("\n\n");
}

export function renderTransform(
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
  const unit = translateConfig.unit === "custom" ? translateConfig.customUnit ?? "px" : translateConfig.unit;
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
