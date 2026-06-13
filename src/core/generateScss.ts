import { formatScss } from "./formatScss.js";
import { normalizeWebKeyframesData } from "./normalize.js";
import type { WebKeyframesData } from "./types.js";

export function generateScss(data: WebKeyframesData): string {
  const normalized = normalizeWebKeyframesData(data);

  const keyframeBlocks = normalized.keyframes.map((keyframe) => {
    const percent = formatPercent((keyframe.time / normalized.duration) * 100);
    const transform =
      `translate(${normalized.unitFunction}(${formatNumber(keyframe.x)}), ${normalized.unitFunction}(${formatNumber(keyframe.y)})) ` +
      `scale(${formatNumber(keyframe.scale)}) rotate(${formatNumber(keyframe.rotate)}deg)`;

    return [
      `  ${percent} {`,
      `    transform: ${transform};`,
      `    opacity: ${formatNumber(keyframe.opacity)};`,
      "  }",
    ].join("\n");
  });

  const keyframes = ["@keyframes " + normalized.id + " {", ...keyframeBlocks, "}"].join("\n\n");

  const target = [
    `${normalized.target} {`,
    `  animation: ${normalized.id} ${formatNumber(normalized.duration)}ms ease-out forwards;`,
    "}",
  ].join("\n");

  return formatScss([keyframes, target]);
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
