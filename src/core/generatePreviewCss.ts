import { formatScss } from "./formatScss.js";
import { normalizeWebKeyframesData } from "./normalize.js";
import type { TransformOperation, WebKeyframesData } from "./types.js";

export function generatePreviewCss(data: WebKeyframesData, keyframesName?: string): string {
  const normalized = normalizeWebKeyframesData(data);
  const animationName = keyframesName?.trim() || normalized.id;

  const keyframeBlocks = normalized.keyframes.map((keyframe) => {
    const percent = formatPercent((keyframe.time / normalized.duration) * 100);
    const transform = keyframe.transforms
      .map((item) => renderPreviewTransform(item, normalized.translate))
      .join(" ");

    return [
      `  ${percent} {`,
      `    transform: ${transform};`,
      `    opacity: ${formatNumber(keyframe.opacity)};`,
      "  }",
    ].join("\n");
  });

  return formatScss([["@keyframes " + animationName + " {", ...keyframeBlocks, "}"].join("\n\n")]);
}

function renderPreviewTransform(
  transform: TransformOperation,
  translate: ReturnType<typeof normalizeWebKeyframesData>["translate"],
): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${renderPreviewTranslateValue(transform.x, translate)}, ${renderPreviewTranslateValue(transform.y, translate)})`;
    case "scale":
      return `scale(${formatNumber(transform.value)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
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
