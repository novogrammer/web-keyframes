import { formatCss } from "./formatCss.js";
import { getOpacityProperty, getTransformProperty, normalizeWebKeyframesTimeline } from "./normalize.js";
import { validateWebKeyframesTimeline } from "./validate.js";
import { formatNumber, renderTransform } from "./generateCss.js";
import type { WebKeyframesTimeline } from "./types.js";

export function generatePreviewCss(data: WebKeyframesTimeline, keyframesName?: string): string {
  const validated = validateWebKeyframesTimeline(data);
  const normalized = normalizeWebKeyframesTimeline(data);
  const animationName = keyframesName?.trim() || normalized.id;
  const keyframesByTime = [...validated.keyframes].sort((left, right) => left.time - right.time);

  const keyframeBlocks = keyframesByTime.map((keyframe, index) => {
    const percent = formatPercent((normalized.keyframes[index].time / normalized.duration) * 100);
    const lines = [`  ${percent} {`];
    const transformProperty = getTransformProperty(keyframe);
    const opacityProperty = getOpacityProperty(keyframe);

    if (transformProperty) {
      lines.push(
        transformProperty.value.length > 0
          ? `    transform: ${transformProperty.value.map((item) => renderTransform(item, normalized.translate, true)).join(" ")};`
          : "    transform: none;",
      );
    }

    if (opacityProperty && Number.isFinite(opacityProperty.value)) {
      lines.push(`    opacity: ${formatNumber(opacityProperty.value)};`);
    }

    lines.push("  }");
    return lines.join("\n");
  });

  return formatCss([["@keyframes " + animationName + " {", ...keyframeBlocks, "}"].join("\n\n")]);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}
