import { formatCss } from "./formatCss.js";
import { normalizeWebKeyframesTimeline } from "./normalize.js";
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

    if (Array.isArray(keyframe.transforms)) {
      lines.push(
        keyframe.transforms.length > 0
          ? `    transform: ${keyframe.transforms.map((item) => renderTransform(item, normalized.translate, true)).join(" ")};`
          : "    transform: none;",
      );
    }

    if (typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity)) {
      lines.push(`    opacity: ${formatNumber(keyframe.opacity)};`);
    }

    lines.push("  }");
    return lines.join("\n");
  });

  return formatCss([["@keyframes " + animationName + " {", ...keyframeBlocks, "}"].join("\n\n")]);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}
