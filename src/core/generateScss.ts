import { formatScss } from "./formatScss.js";
import { normalizeWebKeyframesDocument, normalizeWebKeyframesTimeline } from "./normalize.js";
import { validateWebKeyframesDocument, validateWebKeyframesTimeline } from "./validate.js";
import type {
  NormalizedTranslateConfig,
  TransformOperation,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "./types.js";

export function generateScss(data: WebKeyframesDocument): string {
  const validated = validateWebKeyframesDocument(data);
  const normalized = normalizeWebKeyframesDocument(data);

  return formatScss(
    validated.timelines.map((timeline, index) => renderTimelineScss(timeline, normalized.timelines[index])),
  );
}

export function generateTimelineScss(data: WebKeyframesTimeline): string {
  const validated = validateWebKeyframesTimeline(data);
  const normalized = normalizeWebKeyframesTimeline(data);
  return formatScss([renderTimelineScss(validated, normalized)]);
}

function renderTimelineScss(
  validated: WebKeyframesTimeline,
  normalized: ReturnType<typeof normalizeWebKeyframesTimeline>,
): string {
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
      return `scale(${formatNumber(transform.value)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function renderTranslateValue(
  value: number,
  translate: NormalizedTranslateConfig,
  previewMode: boolean,
): string {
  const unit = translate.unit === "custom" ? translate.customUnit ?? "px" : translate.unit;
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
