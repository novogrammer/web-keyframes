import type {
  KeyframePositionMode,
  KeyframeProperty,
  NormalizedTranslateConfig,
  NormalizedWebKeyframe,
  NormalizedWebKeyframesDocument,
  NormalizedWebKeyframesTimeline,
  OpacityProperty,
  PropertyKind,
  TransformProperty,
  TransformKind,
  TransformOperation,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "./types.js";
import { validateWebKeyframesDocument, validateWebKeyframesTimeline } from "./validate.js";

export const DEFAULT_TRANSLATE_CONFIG: NormalizedTranslateConfig = {
  unit: "px",
};

export function normalizeWebKeyframesDocument(data: WebKeyframesDocument): NormalizedWebKeyframesDocument {
  const validated = validateWebKeyframesDocument(data);
  return {
    timelines: validated.timelines.map((timeline) => normalizeValidatedTimeline(timeline)),
  };
}

export function normalizeWebKeyframesTimeline(data: WebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  const validated = validateWebKeyframesTimeline(data);
  return normalizeValidatedTimeline(validated);
}

function normalizeValidatedTimeline(validated: WebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  const positionType = validated.positionType;
  const duration = positionType === "time" ? validated.duration ?? null : null;
  const keyframes = [...validated.keyframes]
    .sort((left, right) => getKeyframePositionValue(left, positionType) - getKeyframePositionValue(right, positionType))
    .map((keyframe) => normalizeKeyframe(keyframe, positionType, duration));

  return {
    animationName: validated.animationName.trim(),
    positionType,
    duration,
    translateConfig: {
      unit: validated.translateConfig?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
    },
    keyframes,
  };
}

function normalizeKeyframe(
  keyframe: WebKeyframe,
  positionType: KeyframePositionMode,
  duration: number | null,
): NormalizedWebKeyframe {
  return {
    time: positionType === "time" ? (keyframe.time ?? null) : null,
    percent: positionType === "time"
      ? (((keyframe.time ?? 0) / Math.max(duration ?? 1, 1)) * 100)
      : (keyframe.percent ?? 0),
    timingFunction: typeof keyframe.timingFunction === "string" ? keyframe.timingFunction : null,
    properties: Array.isArray(keyframe.properties) ? cloneProperties(keyframe.properties) : [],
  };
}

export function cloneTransform(transform: TransformOperation): TransformOperation {
  switch (transform.kind) {
    case "translate":
      return { kind: "translate", x: transform.x, y: transform.y };
    case "scale":
      return { kind: "scale", x: transform.x, y: transform.y };
    case "rotate":
      return { kind: "rotate", value: transform.value };
    case "skew":
      return { kind: "skew", x: transform.x, y: transform.y };
  }
}

export function cloneTimeline(timeline: WebKeyframesTimeline | NormalizedWebKeyframesTimeline): WebKeyframesTimeline {
  const positionType = timeline.positionType;
  return {
    animationName: timeline.animationName.trim(),
    positionType,
    ...(positionType === "time" && typeof timeline.duration === "number" ? { duration: timeline.duration } : {}),
    ...(timeline.translateConfig ? { translateConfig: { unit: timeline.translateConfig.unit } } : {}),
    keyframes: timeline.keyframes.map((keyframe) => cloneTimelineKeyframe(keyframe, positionType)),
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
      return { kind: "scale", x: 1, y: 1 };
    case "rotate":
      return { kind: "rotate", value: 0 };
    case "skew":
      return { kind: "skew", x: 0, y: 0 };
  }
}

export function createOpacityProperty(value: number): OpacityProperty {
  return { kind: "opacity", value };
}

export function createTransformProperty(value: TransformOperation[]): TransformProperty {
  return { kind: "transform", value: value.map(cloneTransform) };
}

function cloneProperty(property: KeyframeProperty): KeyframeProperty {
  switch (property.kind) {
    case "opacity":
      return createOpacityProperty(property.value);
    case "transform":
      return createTransformProperty(property.value);
  }
}

export function cloneProperties(properties: KeyframeProperty[]): KeyframeProperty[] {
  return properties.map(cloneProperty);
}

function cloneTimelineKeyframe(
  keyframe: WebKeyframe | NormalizedWebKeyframe,
  positionType: KeyframePositionMode,
): WebKeyframe {
  return {
    ...(positionType === "time" ? { time: keyframe.time ?? 0 } : { percent: keyframe.percent ?? 0 }),
    ...(keyframe.timingFunction ? { timingFunction: keyframe.timingFunction } : {}),
    ...(Array.isArray(keyframe.properties) ? { properties: cloneProperties(keyframe.properties) } : {}),
  };
}

function getKeyframeProperty(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
  kind: PropertyKind,
): KeyframeProperty | null {
  if (!keyframe) {
    return null;
  }
  const properties = Array.isArray(keyframe.properties) ? keyframe.properties : [];
  return properties.find((property) => property.kind === kind) ?? null;
}

export function getOpacityProperty(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
): OpacityProperty | null {
  const property = getKeyframeProperty(keyframe, "opacity");
  return property?.kind === "opacity" ? property : null;
}

export function getTransformProperty(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
): TransformProperty | null {
  const property = getKeyframeProperty(keyframe, "transform");
  return property?.kind === "transform" ? property : null;
}

export function hasKeyframeProperty(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
  kind: PropertyKind,
): boolean {
  return getKeyframeProperty(keyframe, kind) !== null;
}

export function getOpacityValue(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
  fallback: number | null = null,
): number | null {
  const property = getOpacityProperty(keyframe);
  return property ? property.value : fallback;
}

export function getTransformOperations(
  keyframe: Pick<WebKeyframe, "properties"> | Pick<NormalizedWebKeyframe, "properties"> | null | undefined,
  fallback: TransformOperation[] = [],
): TransformOperation[] {
  const property = getTransformProperty(keyframe);
  return property ? property.value.map(cloneTransform) : fallback.map(cloneTransform);
}

export function getKeyframePositionValue(
  keyframe: Pick<WebKeyframe, "time" | "percent"> | Pick<NormalizedWebKeyframe, "time" | "percent">,
  positionType: KeyframePositionMode,
): number {
  return positionType === "time" ? (keyframe.time ?? 0) : (keyframe.percent ?? 0);
}

export function upsertKeyframeProperty(
  keyframe: WebKeyframe | NormalizedWebKeyframe,
  property: KeyframeProperty,
): void {
  const next = cloneProperty(property);
  const properties = Array.isArray(keyframe.properties) ? cloneProperties(keyframe.properties) : [];
  const index = properties.findIndex((candidate) => candidate.kind === next.kind);
  if (index === -1) {
    properties.push(next);
  } else {
    properties[index] = next;
  }
  keyframe.properties = properties;
}

export function deleteKeyframeProperty(
  keyframe: WebKeyframe | NormalizedWebKeyframe,
  kind: PropertyKind,
): void {
  if (!Array.isArray(keyframe.properties)) {
    return;
  }

  keyframe.properties = keyframe.properties.filter((property) => property.kind !== kind).map(cloneProperty);
}
