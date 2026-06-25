import { addTransform } from "../core/edit.js";
import {
  createDefaultTransform,
  createOpacityProperty,
  createTransformProperty,
  deleteKeyframeProperty,
  hasKeyframeProperty,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type { TransformKind, WebKeyframe, WebKeyframesTimeline } from "../core/types.js";

export function setKeyframeTimingFunction(keyframe: WebKeyframe, value: string): void {
  keyframe.timingFunction = value;
}

export function clearKeyframeTimingFunction(keyframe: WebKeyframe): void {
  delete keyframe.timingFunction;
}

export function ensureKeyframeOpacity(keyframe: WebKeyframe, value = 1): void {
  upsertKeyframeProperty(keyframe, createOpacityProperty(value));
}

export function deleteKeyframeOpacity(keyframe: WebKeyframe): void {
  deleteKeyframeProperty(keyframe, "opacity");
}

export function deleteKeyframeTransforms(keyframe: WebKeyframe): void {
  deleteKeyframeProperty(keyframe, "transform");
}

export function clearKeyframeTransforms(keyframe: WebKeyframe): void {
  upsertKeyframeProperty(keyframe, createTransformProperty([]));
}

export function addKeyframeTransform(
  timeline: WebKeyframesTimeline,
  keyframeIndex: number,
  keyframe: WebKeyframe,
  kind: TransformKind,
): WebKeyframesTimeline | null {
  if (!hasKeyframeProperty(keyframe, "transform")) {
    upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(kind)]));
    return null;
  }

  return addTransform(timeline, keyframeIndex, kind);
}
