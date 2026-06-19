import type {
  NormalizedTranslateConfig,
  NormalizedWebKeyframe,
  NormalizedWebKeyframesData,
  TransformKind,
  TransformOperation,
  WebKeyframe,
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
  const sortedKeyframes = [...validated.keyframes].sort((left, right) => left.time - right.time);
  const keyframes = sortedKeyframes.reduce<NormalizedWebKeyframe[]>((accumulator, keyframe) => {
    const previous = accumulator[accumulator.length - 1];
    accumulator.push(normalizeKeyframe(keyframe, previous));
    return accumulator;
  }, []);

  return {
    ...validated,
    translate: {
      unit: translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: translate
        ? translate.functionName?.trim() || null
        : DEFAULT_TRANSLATE_CONFIG.functionName,
      customUnit: translate?.unit === "custom" ? translate.customUnit?.trim() || null : null,
    },
    keyframes,
  };
}

export function normalizeKeyframe(
  keyframe: WebKeyframe,
  previous?: NormalizedWebKeyframe,
): NormalizedWebKeyframe {
  return {
    time: keyframe.time,
    opacity: typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity)
      ? keyframe.opacity
      : previous?.opacity ?? 1,
    transforms: normalizeTransforms(keyframe, previous?.transforms ?? []),
  };
}

export function normalizeTransforms(keyframe: WebKeyframe, fallback: TransformOperation[] = []): TransformOperation[] {
  if (Array.isArray(keyframe.transforms)) {
    return keyframe.transforms.map(cloneTransform);
  }

  return fallback.map(cloneTransform);
}

export function cloneTransform(transform: TransformOperation): TransformOperation {
  switch (transform.kind) {
    case "translate":
      return { kind: "translate", x: transform.x, y: transform.y };
    case "scale":
      return { kind: "scale", value: transform.value };
    case "rotate":
      return { kind: "rotate", value: transform.value };
    case "skew":
      return { kind: "skew", x: transform.x, y: transform.y };
  }
}

export function createDefaultTransform(kind: TransformKind): TransformOperation {
  switch (kind) {
    case "translate":
      return { kind: "translate", x: 0, y: 0 };
    case "scale":
      return { kind: "scale", value: 1 };
    case "rotate":
      return { kind: "rotate", value: 0 };
    case "skew":
      return { kind: "skew", x: 0, y: 0 };
  }
}
