import {
  cloneTransform,
  createDefaultTransform,
  normalizeWebKeyframesData,
} from "./normalize.js";
import type {
  NormalizedWebKeyframesData,
  TransformKind,
  TransformOperation,
  WebKeyframesData,
} from "./types.js";

export type TransformValueField = "x" | "y" | "value";

export function duplicateKeyframes(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  timeOffset?: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const uniqueIndexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (uniqueIndexes.length === 0) {
    return normalized;
  }

  const offset = Number.isFinite(timeOffset)
    ? Math.round(timeOffset as number)
    : Math.max(1, Math.round(normalized.duration * 0.1));

  const duplicates = uniqueIndexes.map((index) => {
    const source = normalized.keyframes[index];
    return {
      ...source,
      transforms: source.transforms.map(cloneTransform),
      time: clampNumber(source.time + offset, 0, normalized.duration),
    };
  });

  return sortKeyframes({
    ...normalized,
    keyframes: [...normalized.keyframes, ...duplicates],
  });
}

export function offsetKeyframeTimes(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  amount: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const selected = new Set(getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length));

  if (selected.size === 0 || !Number.isFinite(amount)) {
    return normalized;
  }

  return sortKeyframes({
    ...normalized,
    keyframes: normalized.keyframes.map((keyframe, index) =>
      selected.has(index)
        ? { ...keyframe, time: clampNumber(keyframe.time + Math.round(amount), 0, normalized.duration) }
        : keyframe,
    ),
  });
}

export function spreadKeyframeTimes(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  startTime: number,
  endTime: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const indexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (indexes.length < 2) {
    return normalized;
  }

  const start = clampNumber(Math.round(startTime), 0, normalized.duration);
  const end = clampNumber(Math.round(endTime), 0, normalized.duration);
  const [from, to] = start <= end ? [start, end] : [end, start];
  const step = indexes.length === 1 ? 0 : (to - from) / (indexes.length - 1);

  const nextKeyframes = normalized.keyframes.map((keyframe) => ({
    ...keyframe,
    transforms: keyframe.transforms.map(cloneTransform),
  }));

  indexes.forEach((index, order) => {
    nextKeyframes[index].time = Math.round(from + step * order);
  });

  return sortKeyframes({
    ...normalized,
    keyframes: nextKeyframes,
  });
}

export function staggerKeyframes(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  stepMs: number,
  startTime?: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const indexes = getSortedUniqueIndexes(keyframeIndexes, normalized.keyframes.length);

  if (indexes.length === 0 || !Number.isFinite(stepMs)) {
    return normalized;
  }

  const anchor = startTime === undefined
    ? normalized.keyframes[indexes[0]].time
    : clampNumber(Math.round(startTime), 0, normalized.duration);
  const step = Math.round(stepMs);
  const nextKeyframes = normalized.keyframes.map((keyframe) => ({
    ...keyframe,
    transforms: keyframe.transforms.map(cloneTransform),
  }));

  indexes.forEach((index, order) => {
    nextKeyframes[index].time = clampNumber(anchor + step * order, 0, normalized.duration);
  });

  return sortKeyframes({
    ...normalized,
    keyframes: nextKeyframes,
  });
}

export function nudgeTransforms(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  transformIndexes: number[],
  field: TransformValueField,
  amount: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
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
        transforms: keyframe.transforms.map((transform, transformIndex) => {
          if (!selectedTransforms.has(transformIndex)) {
            return cloneTransform(transform);
          }

          return updateTransformField(transform, field, amount);
        }),
      };
    }),
  };
}

export function mirrorTransforms(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndexes: number[],
  transformIndexes: number[],
  field: TransformValueField,
  origin = 0,
): NormalizedWebKeyframesData {
  return nudgeTransforms(
    data,
    keyframeIndexes,
    transformIndexes,
    field,
    0,
  ).keyframes.reduce<NormalizedWebKeyframesData>((accumulator, keyframe, keyframeIndex) => {
    const selectedKeyframes = new Set(getSortedUniqueIndexes(keyframeIndexes, accumulator.keyframes.length));
    const selectedTransforms = new Set(transformIndexes);

    if (!selectedKeyframes.has(keyframeIndex)) {
      return accumulator;
    }

    accumulator.keyframes[keyframeIndex] = {
      ...keyframe,
      transforms: keyframe.transforms.map((transform, transformIndex) => {
        if (!selectedTransforms.has(transformIndex)) {
          return cloneTransform(transform);
        }

        return setTransformField(transform, field, origin - (readTransformField(transform, field) - origin));
      }),
    };
    return accumulator;
  }, normalizeEditableData(data));
}

export function replaceTransformKind(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  transformIndex: number,
  kind: TransformKind,
): NormalizedWebKeyframesData {
  return updateSingleTransform(data, keyframeIndex, transformIndex, () => createDefaultTransform(kind));
}

export function moveTransform(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  transformIndex: number,
  direction: -1 | 1,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe) {
    return normalized;
  }

  const nextIndex = clampNumber(transformIndex + direction, 0, keyframe.transforms.length - 1);
  if (nextIndex === transformIndex) {
    return normalized;
  }

  const transforms = keyframe.transforms.map(cloneTransform);
  const [moved] = transforms.splice(transformIndex, 1);
  transforms.splice(nextIndex, 0, moved);

  const keyframes = normalized.keyframes.map((item, index) =>
    index === keyframeIndex ? { ...item, transforms } : item,
  );

  return {
    ...normalized,
    keyframes,
  };
}

export function addTransform(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  kind: TransformKind,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) =>
    index === keyframeIndex
      ? { ...item, transforms: [...item.transforms.map(cloneTransform), createDefaultTransform(kind)] }
      : item,
  );

  return {
    ...normalized,
    keyframes,
  };
}

export function removeTransform(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  transformIndex: number,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe || keyframe.transforms.length <= 1) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) =>
    index === keyframeIndex
      ? { ...item, transforms: item.transforms.filter((_, index2) => index2 !== transformIndex).map(cloneTransform) }
      : item,
  );

  return {
    ...normalized,
    keyframes,
  };
}

export function setTransformFieldValue(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  transformIndex: number,
  field: TransformValueField,
  value: number,
): NormalizedWebKeyframesData {
  if (!Number.isFinite(value)) {
    return normalizeEditableData(data);
  }

  return updateSingleTransform(data, keyframeIndex, transformIndex, (transform) => setTransformField(transform, field, value));
}

function updateSingleTransform(
  data: WebKeyframesData | NormalizedWebKeyframesData,
  keyframeIndex: number,
  transformIndex: number,
  update: (transform: TransformOperation) => TransformOperation,
): NormalizedWebKeyframesData {
  const normalized = normalizeEditableData(data);
  const keyframe = normalized.keyframes[keyframeIndex];

  if (!keyframe || !keyframe.transforms[transformIndex]) {
    return normalized;
  }

  const keyframes = normalized.keyframes.map((item, index) =>
    index === keyframeIndex
      ? {
          ...item,
          transforms: item.transforms.map((transform, index2) =>
            index2 === transformIndex ? update(transform) : cloneTransform(transform),
          ),
        }
      : item,
  );

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
      return { kind: "scale", value };
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

function sortKeyframes(data: NormalizedWebKeyframesData): NormalizedWebKeyframesData {
  return {
    ...data,
    keyframes: [...data.keyframes].sort((left, right) => left.time - right.time),
  };
}

function normalizeEditableData(data: WebKeyframesData | NormalizedWebKeyframesData): NormalizedWebKeyframesData {
  const candidate = data as NormalizedWebKeyframesData;
  return normalizeWebKeyframesData({
    id: candidate.id,
    duration: candidate.duration,
    translate: candidate.translate
      ? {
          unit: candidate.translate.unit,
          functionName: candidate.translate.functionName ?? undefined,
          customUnit: candidate.translate.customUnit ?? undefined,
        }
      : undefined,
    keyframes: candidate.keyframes.map((keyframe) => ({
      time: keyframe.time,
      opacity: keyframe.opacity,
      transforms: keyframe.transforms.map(cloneTransform),
    })),
  });
}

function getSortedUniqueIndexes(indexes: number[], length: number): number[] {
  return [...new Set(indexes.map((index) => Math.round(index)).filter((index) => index >= 0 && index < length))].sort((left, right) => left - right);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
