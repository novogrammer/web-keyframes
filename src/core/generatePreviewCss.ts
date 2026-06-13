import { formatScss } from "./formatScss.js";
import { normalizeWebKeyframesData } from "./normalize.js";
import type { WebKeyframesData } from "./types.js";

export function generatePreviewCss(data: WebKeyframesData, keyframesName?: string): string {
  const normalized = normalizeWebKeyframesData(data);
  const animationName = keyframesName?.trim() || normalized.id;

  const keyframeBlocks = normalized.keyframes.map((keyframe) => {
    const percent = formatPercent((keyframe.time / normalized.duration) * 100);
    const transform =
      `translate(${renderPreviewTranslateValue(keyframe.x, normalized.translate)}, ${renderPreviewTranslateValue(keyframe.y, normalized.translate)}) ` +
      `scale(${formatNumber(keyframe.scale)}) rotate(${formatNumber(keyframe.rotate)}deg)`;

    return [
      `  ${percent} {`,
      `    transform: ${transform};`,
      `    opacity: ${formatNumber(keyframe.opacity)};`,
      "  }",
    ].join("\n");
  });

  return formatScss([["@keyframes " + animationName + " {", ...keyframeBlocks, "}"].join("\n\n")]);
}

function renderPreviewTranslateValue(
  value: number,
  translate: ReturnType<typeof normalizeWebKeyframesData>["translate"],
): string {
  const unit = translate.unit === "custom" ? translate.customUnit ?? "px" : translate.unit;
  return `${formatNumber(value)}${unit}`;
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}
