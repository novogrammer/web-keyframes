import { formatCss } from "./formatCss.js";
import {
  getKeyframePositionValue,
  getOpacityProperty,
  getTimelinePositionType,
  getTransformProperty,
  normalizeWebKeyframesTimeline,
} from "./normalize.js";
import { validateWebKeyframesTimeline } from "./validate.js";
import { formatNumber, renderTransform } from "./generateCss.js";
import type { WebKeyframesTimeline } from "./types.js";

export function generatePreviewCss(data: WebKeyframesTimeline, keyframesName?: string): string {
  const validated = validateWebKeyframesTimeline(data);
  const normalized = normalizeWebKeyframesTimeline(data);
  const animationName = keyframesName?.trim() || normalized.id;
  const positionType = getTimelinePositionType(validated);
  const keyframesByTime = [...validated.keyframes].sort(
    (left, right) => getKeyframePositionValue(left, positionType) - getKeyframePositionValue(right, positionType),
  );

  const keyframeBlocks = keyframesByTime.map((keyframe, index) => {
    const percent = formatPercent(normalized.keyframes[index].percent);
    const lines = [`  ${percent} {`];
    const transformProperty = getTransformProperty(keyframe);
    const opacityProperty = getOpacityProperty(keyframe);
    const timingFunction = normalized.keyframes[index].timingFunction;

    if (transformProperty) {
      lines.push(
        transformProperty.value.length > 0
          ? `    transform: ${transformProperty.value.map((item) => renderTransform(item, normalized.translateConfig, true)).join(" ")};`
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

  return formatCss([["@keyframes " + animationName + " {", ...keyframeBlocks, "}"].join("\n\n")]);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}
