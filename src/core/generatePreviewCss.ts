import { normalizeWebKeyframesTimeline } from "./normalize.js";
import { validateWebKeyframesTimeline } from "./validate.js";
import { generateTimelineCss } from "./generateCss.js";
import type { WebKeyframesTimeline } from "./types.js";

export function generatePreviewCss(data: WebKeyframesTimeline, keyframesName?: string): string {
  const validated = validateWebKeyframesTimeline(data);
  const normalized = normalizeWebKeyframesTimeline(data);
  const animationName = keyframesName?.trim() || normalized.id;
  if (animationName === normalized.id) {
    return generateTimelineCss(data);
  }

  const css = generateTimelineCss(data);
  return css.replace(/^@keyframes\s+[^\s{]+\s+\{/, `@keyframes ${animationName} {`);
}
