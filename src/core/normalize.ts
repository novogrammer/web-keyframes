import type {
  NormalizedTranslateConfig,
  NormalizedWebKeyframesData,
  WebKeyframesData,
} from "./types.js";
import { validateWebKeyframesData } from "./validate.js";

export const DEFAULT_TRANSLATE_CONFIG: NormalizedTranslateConfig = {
  unit: "px",
  functionName: "global.vw",
  customUnit: null,
};

export function normalizeWebKeyframesData(data: WebKeyframesData): NormalizedWebKeyframesData {
  const validated = validateWebKeyframesData(data);
  const translate = validated.translate;

  return {
    ...validated,
    translate: {
      unit: translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: translate
        ? translate.functionName?.trim() || null
        : DEFAULT_TRANSLATE_CONFIG.functionName,
      customUnit: translate?.unit === "custom" ? translate.customUnit?.trim() || null : null,
    },
    keyframes: [...validated.keyframes].sort((left, right) => left.time - right.time),
  };
}
