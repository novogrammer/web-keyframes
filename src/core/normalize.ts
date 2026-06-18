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

  return {
    ...validated,
    translate: {
      unit: translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: translate
        ? translate.functionName?.trim() || null
        : DEFAULT_TRANSLATE_CONFIG.functionName,
      customUnit: translate?.unit === "custom" ? translate.customUnit?.trim() || null : null,
    },
    keyframes: validated.keyframes
      .map((keyframe) => normalizeKeyframe(keyframe))
      .sort((left, right) => left.time - right.time),
  };
}

export function normalizeKeyframe(keyframe: WebKeyframe): NormalizedWebKeyframe {
  return {
    time: keyframe.time,
    opacity: keyframe.opacity,
    transforms: normalizeTransforms(keyframe),
  };
}

export function normalizeTransforms(keyframe: WebKeyframe): TransformOperation[] {
  if (Array.isArray(keyframe.transforms) && keyframe.transforms.length > 0) {
    return keyframe.transforms.map(cloneTransform);
  }

  return createLegacyTransforms(keyframe);
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

function createLegacyTransforms(keyframe: WebKeyframe): TransformOperation[] {
  const transforms: TransformOperation[] = [
    {
      kind: "translate",
      x: keyframe.x ?? 0,
      y: keyframe.y ?? 0,
    },
    {
      kind: "scale",
      value: keyframe.scale ?? 1,
    },
    {
      kind: "rotate",
      value: keyframe.rotate ?? 0,
    },
  ];

  if ((keyframe.skewX ?? 0) !== 0 || (keyframe.skewY ?? 0) !== 0) {
    transforms.push({
      kind: "skew",
      x: keyframe.skewX ?? 0,
      y: keyframe.skewY ?? 0,
    });
  }

  return transforms;
}
