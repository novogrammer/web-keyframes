import {
  cloneTimeline,
  cloneTransform,
  createOpacityProperty,
  createDefaultTransform,
  createTransformProperty,
  getOpacityValue,
  getTransformOperations,
  normalizeWebKeyframesTimeline,
  upsertKeyframeProperty,
} from "./normalize.js";
import type {
  NormalizedWebKeyframesTimeline,
  TransformKind,
  TransformOperation,
  WebKeyframesTimeline,
} from "./types.js";

export type TransformValueField = "x" | "y" | "value";

export function duplicateKeyframes(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  timeOffset?: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const uniqueIndexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (uniqueIndexes.length === 0) {
    return normalized;
  }

  const offset = Number.isFinite(timeOffset)
    ? toPercentDelta(normalized, timeOffset as number)
    : defaultPercentOffset(normalized);

  const duplicates = uniqueIndexes.map((index) => {
    const source = normalized.keyframes[index];
    return {
      ...source,
      properties: source.properties.map((property) => {
        if (property.kind === "transform") {
          return createTransformProperty(property.value.map(cloneTransform));
        }
        return createOpacityProperty(property.value);
      }),
      ...setNormalizedPercent(source, clampNumber(source.percent + offset, 0, 100), normalized.duration),
    };
  });

  return sortKeyframes({
    ...normalized,
    keyframes: [...normalized.keyframes, ...duplicates],
  });
}

export function offsetKeyframeTimes(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  amount: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const selected = new Set(getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length));

  if (selected.size === 0 || !Number.isFinite(amount)) {
    return normalized;
  }

  return sortKeyframes({
    ...normalized,
    keyframes: normalized.keyframes.map((keyframe, index) =>
      selected.has(index)
        ? { ...keyframe, ...setNormalizedPercent(keyframe, clampNumber(keyframe.percent + toPercentDelta(normalized, amount), 0, 100), normalized.duration) }
        : keyframe,
    ),
  });
}

export function spreadKeyframeTimes(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  startTime: number,
  endTime: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const indexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (indexes.length < 2) {
    return normalized;
  }

  const start = clampNumber(toPercentValue(normalized, startTime), 0, 100);
  const end = clampNumber(toPercentValue(normalized, endTime), 0, 100);
  const [from, to] = start <= end ? [start, end] : [end, start];
  const step = indexes.length === 1 ? 0 : (to - from) / (indexes.length - 1);

  const nextKeyframes = normalized.keyframes.map((keyframe) => ({
    ...keyframe,
    properties: keyframe.properties.map((property) =>
      property.kind === "transform"
        ? createTransformProperty(property.value.map(cloneTransform))
        : createOpacityProperty(property.value)
    ),
  }));

  indexes.forEach((index, order) => {
    Object.assign(nextKeyframes[index], setNormalizedPercent(nextKeyframes[index], from + step * order, normalized.duration));
  });

  return sortKeyframes({
    ...normalized,
    keyframes: nextKeyframes,
  });
}

export function staggerKeyframes(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  stepMs: number,
  startTime?: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const indexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (indexes.length === 0 || !Number.isFinite(stepMs)) {
    return normalized;
  }

  const anchor = startTime === undefined
    ? normalized.keyframes[indexes[0]].percent
    : clampNumber(toPercentValue(normalized, startTime), 0, 100);
  const step = toPercentDelta(normalized, stepMs);
  const nextKeyframes = normalized.keyframes.map((keyframe) => ({
    ...keyframe,
    properties: keyframe.properties.map((property) =>
      property.kind === "transform"
        ? createTransformProperty(property.value.map(cloneTransform))
        : createOpacityProperty(property.value)
    ),
  }));

  indexes.forEach((index, order) => {
    Object.assign(
      nextKeyframes[index],
      setNormalizedPercent(nextKeyframes[index], clampNumber(anchor + step * order, 0, 100), normalized.duration),
    );
  });

  return sortKeyframes({
    ...normalized,
    keyframes: nextKeyframes,
  });
}

export function nudgeTransforms(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  transformIndexes: number[],
  field: TransformValueField,
  amount: number,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const selectedKeyframes = new Set(getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length));
  const selectedTransforms = new Set(transformIndexes);

  if (selectedKeyframes.size === 0 || selectedTransforms.size === 0 || !Number.isFinite(amount)) {
    return normalized;
  }

  return {
    ...normalized,
    keyframes: normalized.keyframes.map((keyframe, keyframeIndex) => {
      if (!selectedKeyframes.has(keyframeIndex)) {
        return keyframe;
      }

      return {
        ...keyframe,
        properties: keyframe.properties.map((property) => {
          if (property.kind !== "transform") {
            return createOpacityProperty(property.value);
          }

          return createTransformProperty(property.value.map((transform, transformIndex) => {
            if (!selectedTransforms.has(transformIndex)) {
              return cloneTransform(transform);
            }

            return updateTransformField(transform, field, amount);
          }));
        }),
      };
    }),
  };
}

export function mirrorTransforms(
  data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  keyframeIndexes: number[],
  transformIndexes: number[],
  field: TransformValueField,
  origin = 0,
): NormalizedWebKeyframesTimeline {
  const normalized = normalizeEditableTimeline(data);
  const selectedKeyframes = new Set(getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length));
  const selectedTransforms = new Set(transformIndexes);

  if (selectedKeyframes.size === 0 || selectedTransforms.size === 0) {
    return normalized;
  }

  return {
    ...normalized,
    keyframes: normalized.keyframes.map((keyframe, keyframeIndex) => {
      if (!selectedKeyframes.has(keyframeIndex)) {
        return keyframe;
      }

      return {
        ...keyframe,
        properties: keyframe.properties.map((property) => {
          if (property.kind !== "transform") {
            return createOpacityProperty(property.value);
          }

          return createTransformProperty(property.value.map((transform, transformIndex) => {
            if (!selectedTransforms.has(transformIndex)) {
              return cloneTransform(transform);
            }

            return setTransformField(transform, field, origin - (readTransformField(transform, field) - origin));
          }));
        }),
      };
    }),
  };
}

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

function updateTransformField(transform: TransformOperation, field: TransformValueField, amount: number): TransformOperation {
  return setTransformField(transform, field, readTransformField(transform, field) + amount);
}

function readTransformField(transform: TransformOperation, field: TransformValueField): number {
  switch (field) {
    case "x":
      return "x" in transform ? transform.x : "value" in transform ? transform.value : 0;
    case "y":
      return "y" in transform ? transform.y : 0;
    case "value":
      return "value" in transform ? transform.value : "x" in transform ? transform.x : 0;
  }
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

function sortKeyframes(data: NormalizedWebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  return {
    ...data,
    keyframes: [...data.keyframes].sort((left, right) => left.percent - right.percent),
  };
}

function normalizeEditableTimeline(data: WebKeyframesTimeline | NormalizedWebKeyframesTimeline): NormalizedWebKeyframesTimeline {
  return normalizeWebKeyframesTimeline(cloneTimeline(data));
}

function getSortedUniqueIndexes(indexes: number[], length: number): number[] {
  return [...new Set(indexes.map((index) => Math.round(index)).filter((index) => index >= 0 && index < length))].sort((left, right) => left - right);
}

function defaultPercentOffset(normalized: NormalizedWebKeyframesTimeline): number {
  return normalized.duration === null
    ? 10
    : (Math.max(1, Math.round(normalized.duration * 0.1)) / normalized.duration) * 100;
}

function toPercentDelta(normalized: NormalizedWebKeyframesTimeline, value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (normalized.duration === null) {
    return value;
  }

  return (value / Math.max(normalized.duration, 1)) * 100;
}

function toPercentValue(normalized: NormalizedWebKeyframesTimeline, value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (normalized.duration === null) {
    return value;
  }

  return (value / Math.max(normalized.duration, 1)) * 100;
}

function setNormalizedPercent(
  keyframe: NormalizedWebKeyframesTimeline["keyframes"][number],
  percent: number,
  duration: number | null,
): Pick<NormalizedWebKeyframesTimeline["keyframes"][number], "percent" | "time"> {
  return {
    percent,
    time: duration === null ? null : Math.round((percent / 100) * duration),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
