import {
  cloneTimeline,
  cloneTransform,
  createOpacityProperty,
  createDefaultTransform,
  createTransformProperty,
  getTransformOperations,
  normalizeWebKeyframesTimeline,
} from "./normalize.js";
import type {
  NormalizedWebKeyframesTimeline,
  TransformKind,
  TransformOperation,
  WebKeyframesTimeline,
} from "./types.js";

type TransformValueField = "x" | "y" | "value";

export function replaceTransformKind(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  transformIndex: number,
  kind: TransformKind,
): NormalizedWebKeyframesTimeline {
  return updateSingleTransform(data, keyframeIndex, transformIndex, () => createDefaultTransform(kind));
}

export function moveTransform(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  transformIndex: number,
  direction: -1 | 1,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe) {
    return normalized;
  }

  const transforms = getTransformOperations(keyframe);
  const nextIndex = clampNumber(transformIndex + direction, 0, transforms.length - 1);
  if (nextIndex === transformIndex) {
    return normalized;
  }

  const nextTransforms = transforms.map(cloneTransform);
  const [moved] = nextTransforms.splice(transformIndex, 1);
  nextTransforms.splice(nextIndex, 0, moved);

  const keyframes = normalized.keyframes.map((item, index) => {
    if (index !== keyframeIndex) {
      return item;
    }

    const nextKeyframe = {
      ...item,
      properties: item.properties.map((property) =>
        property.kind === "transform"
          ? createTransformProperty(nextTransforms)
          : createOpacityProperty(property.value)
      ),
    };
    return nextKeyframe;
  });

  return {
    ...normalized,
    keyframes,
  };
}

export function addTransform(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  kind: TransformKind,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) => {
    if (index !== keyframeIndex) {
      return item;
    }

    return {
      ...item,
      properties: item.properties.map((property) =>
        property.kind === "transform"
          ? createTransformProperty([...property.value.map(cloneTransform), createDefaultTransform(kind)])
          : createOpacityProperty(property.value)
      ),
    };
  });

  return {
    ...normalized,
    keyframes,
  };
}

export function removeTransform(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  transformIndex: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) => {
    if (index !== keyframeIndex) {
      return item;
    }

    return {
      ...item,
      properties: item.properties.map((property) =>
        property.kind === "transform"
          ? createTransformProperty(property.value.filter((_, index2) => index2 !== transformIndex).map(cloneTransform))
          : createOpacityProperty(property.value)
      ),
    };
  });

  return {
    ...normalized,
    keyframes,
  };
}

export function setTransformFieldValue(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  transformIndex: number,
  field: TransformValueField,
  value: number,
): NormalizedWebKeyframesTimeline {
  if (!Number.isFinite(value)) {
    return normalizeEditableTimeline(data);
  }

  return updateSingleTransform(data, keyframeIndex, transformIndex, (transform) => setTransformField(transform, field, value));
}

function updateSingleTransform(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndex: number,
  transformIndex: number,
  update: (transform: TransformOperation) => TransformOperation,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  const transforms = keyframe ? getTransformOperations(keyframe) : [];
  if (!keyframe || !transforms[transformIndex]) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) => {
    if (index !== keyframeIndex) {
      return item;
    }

    return {
      ...item,
      properties: item.properties.map((property) => {
        if (property.kind !== "transform") {
          return createOpacityProperty(property.value);
        }

        return createTransformProperty(property.value.map((transform, index2) =>
          index2 === transformIndex ? update(transform) : cloneTransform(transform),
        ));
      }),
    };
  });

  return {
    ...normalized,
    keyframes,
  };
}

function setTransformField(transform: TransformOperation, field: TransformValueField, value: number): TransformOperation {
  switch (transform.kind) {
    case "translate":
      if (field === "value") {
        return { kind: "translate", x: value, y: transform.y };
      }
      return field === "x"
        ? { kind: "translate", x: value, y: transform.y }
        : { kind: "translate", x: transform.x, y: value };
    case "scale":
      if (field === "value") {
        return { kind: "scale", x: value, y: value };
      }
      return field === "x"
        ? { kind: "scale", x: value, y: transform.y }
        : { kind: "scale", x: transform.x, y: value };
    case "rotate":
      return { kind: "rotate", value };
    case "skew":
      if (field === "value") {
        return { kind: "skew", x: value, y: transform.y };
      }
      return field === "x"
        ? { kind: "skew", x: value, y: transform.y }
        : { kind: "skew", x: transform.x, y: value };
  }
}

function normalizeEditableTimeline(data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  return normalizeWebKeyframesTimeline(cloneTimeline(data));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
