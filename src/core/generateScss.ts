import { formatScss } from "./formatScss.js";
import { validateWebKeyframesData } from "./validate.js";
import { normalizeWebKeyframesData } from "./normalize.js";
import type { TransformOperation, WebKeyframesData } from "./types.js";

export function generateScss(data: WebKeyframesData): string {
  const validated = validateWebKeyframesData(data);
  const normalized = normalizeWebKeyframesData(data);
  const keyframesByTime = [...validated.keyframes].sort((left, right) => left.time - right.time);

  const keyframeBlocks = keyframesByTime.map((keyframe, index) => {
    const percent = formatPercent((normalized.keyframes[index].time / normalized.duration) * 100);
    const lines = [`  ${percent} {`];

    if (Array.isArray(keyframe.transforms)) {
      lines.push(
        keyframe.transforms.length > 0
          ? `    transform: ${keyframe.transforms.map((item) => renderTransform(item, normalized.translate, false)).join(" ")};`
          : "    transform: none;",
      );
    }

    if (typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity)) {
      lines.push(`    opacity: ${formatNumber(keyframe.opacity)};`);
    }

    lines.push("  }");
    return lines.join("\n");
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
