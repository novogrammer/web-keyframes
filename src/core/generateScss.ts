import { formatScss } from "./formatScss.js";
import { normalizeWebKeyframesData } from "./normalize.js";
import type { TransformOperation, WebKeyframesData } from "./types.js";

export function generateScss(data: WebKeyframesData): string {
  const normalized = normalizeWebKeyframesData(data);

  const keyframeBlocks = normalized.keyframes.map((keyframe) => {
    const percent = formatPercent((keyframe.time / normalized.duration) * 100);
    const transform = keyframe.transforms
      .map((item) => renderTransform(item, normalized.translate, false))
      .join(" ");

    return [
      `  ${percent} {`,
      `    transform: ${transform};`,
      `    opacity: ${formatNumber(keyframe.opacity)};`,
      "  }",
    ].join("\n");
  });

  const keyframes = ["@keyframes " + normalized.id + " {", ...keyframeBlocks, "}"].join("\n\n");
  return formatScss([keyframes]);
}

function renderTransform(
  transform: TransformOperation,
  translate: ReturnType<typeof normalizeWebKeyframesData>["translate"],
  previewMode: boolean,
): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${renderTranslateValue(transform.x, translate, previewMode)}, ${renderTranslateValue(transform.y, translate, previewMode)})`;
    case "scale":
      return `scale(${formatNumber(transform.value)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function renderTranslateValue(
  value: number,
  translate: ReturnType<typeof normalizeWebKeyframesData>["translate"],
  previewMode: boolean,
): string {
  const unit = translate.unit === "custom" ? translate.customUnit ?? "px" : translate.unit;
  const dimension = `${formatNumber(value)}${unit}`;

  if (!previewMode && translate.functionName) {
    return `${translate.functionName}(${dimension})`;
  }

  return dimension;
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
