import type { NormalizedWebKeyframesData, WebKeyframesData } from "./types.js";
import { validateWebKeyframesData } from "./validate.js";

export const DEFAULT_UNIT_FUNCTION = "global.vw";

export function normalizeWebKeyframesData(data: WebKeyframesData): NormalizedWebKeyframesData {
  const validated = validateWebKeyframesData(data);

  return {
    ...validated,
    unitFunction: validated.unitFunction?.trim() || DEFAULT_UNIT_FUNCTION,
    keyframes: [...validated.keyframes].sort((left, right) => left.time - right.time),
  };
}
