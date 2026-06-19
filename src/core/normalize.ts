import type {
  NormalizedTranslateConfig,
  NormalizedWebKeyframe,
  NormalizedWebKeyframesDocument,
  NormalizedWebKeyframesTimeline,
  TransformKind,
  TransformOperation,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "./types.js";
import { validateWebKeyframesDocument, validateWebKeyframesTimeline } from "./validate.js";

export const DEFAULT_TRANSLATE_CONFIG: NormalizedTranslateConfig = {
  unit: "px",
  customUnit: null,
};

export function normalizeWebKeyframesDocument(data: WebKeyframesDocument): NormalizedWebKeyframesDocument {
  const validated = validateWebKeyframesDocument(data);
  return {
    timelines: validated.timelines.map((timeline) => normalizeWebKeyframesTimeline(timeline)),
  };
}

export function normalizeWebKeyframesTimeline(data: WebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  const validated = validateWebKeyframesTimeline(data);
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

export function cloneTimeline(timeline: WebKeyframesTimeline | NormalizedWebKeyframesTimeline): WebKeyframesTimeline {
  return {
    id: timeline.id,
    duration: timeline.duration,
    translate: timeline.translate
      ? {
          unit: timeline.translate.unit,
          customUnit: timeline.translate.customUnit ?? undefined,
        }
      : undefined,
    keyframes: timeline.keyframes.map((keyframe) => ({
      time: keyframe.time,
      opacity: keyframe.opacity,
      transforms: Array.isArray(keyframe.transforms) ? keyframe.transforms.map(cloneTransform) : keyframe.transforms,
    })),
  };
}

export function cloneDocument(document: WebKeyframesDocument | NormalizedWebKeyframesDocument): WebKeyframesDocument {
  return {
    timelines: document.timelines.map((timeline) => cloneTimeline(timeline)),
  };
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
