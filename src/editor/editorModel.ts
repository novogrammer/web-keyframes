import {
  cloneProperties,
  cloneTimeline,
  DEFAULT_TRANSLATE_CONFIG,
  getOpacityValue,
  getTimelinePositionType,
  getTransformOperations,
  hasKeyframeProperty,
} from "../core/normalize.js";
import type {
  KeyframePositionMode,
  TransformOperation,
  TranslateUnit,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/types.js";

type RenderTranslateConfig = {
  unit: TranslateUnit;
};

type RenderWebKeyframesTimeline = Omit<WebKeyframesTimeline, "translateConfig" | "keyframes" | "duration" | "positionType"> & {
  positionType: KeyframePositionMode;
  duration: number | null;
  translateConfig: RenderTranslateConfig;
  keyframes: WebKeyframe[];
};

type EditorRenderState = {
  renderTimelines: RenderWebKeyframesTimeline[];
  selectedTimelineIndex: number;
  selectedKeyframeIndex: number;
  selectedTimeline: RenderWebKeyframesTimeline;
  selectedSourceTimeline: WebKeyframesTimeline;
  selectedKeyframe: WebKeyframe | undefined;
  selectedSourceKeyframe: WebKeyframe | undefined;
  hasSelectedKeyframe: boolean;
  opacitySourceState: "explicit" | "unset";
  selectedSourceOpacity: number | null;
  selectedSourceTransforms: TransformOperation[];
  selectedTimingFunction: string;
  transformSourceState: "unset" | "none" | "explicit";
};

export function deriveEditorRenderState(
  data: WebKeyframesDocument,
  selectedTimelineIndex: number,
  selectedKeyframeIndex: number,
  defaultTimelineData: WebKeyframesTimeline,
): EditorRenderState {
  const sanitizedDocument = sanitizeEditorDocument(data, defaultTimelineData);
  const renderTimelines = getRenderTimelines(sanitizedDocument);
  const selectedTimeline = renderTimelines[selectedTimelineIndex] ?? renderTimelines[0];
  const nextTimelineIndex = renderTimelines.indexOf(selectedTimeline);
  const selectedSourceTimeline = sanitizedDocument.timelines[nextTimelineIndex] ?? sanitizedDocument.timelines[0];
  const selectedKeyframe = selectedTimeline.keyframes[selectedKeyframeIndex] ?? selectedTimeline.keyframes[0];
  const nextKeyframeIndex = selectedKeyframe ? selectedTimeline.keyframes.indexOf(selectedKeyframe) : 0;
  const selectedSourceKeyframe = selectedSourceTimeline.keyframes[nextKeyframeIndex] ?? selectedSourceTimeline.keyframes[0];
  const hasSelectedKeyframe = selectedKeyframe !== undefined && selectedSourceKeyframe !== undefined;
  const opacitySourceState = hasSelectedKeyframe && hasKeyframeProperty(selectedSourceKeyframe, "opacity") ? "explicit" : "unset";
  const selectedSourceOpacity = hasSelectedKeyframe ? getOpacityValue(selectedSourceKeyframe) : null;
  const selectedSourceTransforms = hasSelectedKeyframe && hasKeyframeProperty(selectedSourceKeyframe, "transform")
    ? getTransformOperations(selectedSourceKeyframe)
    : [];
  const selectedTimingFunction = hasSelectedKeyframe && typeof selectedSourceKeyframe.timingFunction === "string"
    ? selectedSourceKeyframe.timingFunction.trim()
    : "";
  const transformSourceState = !hasSelectedKeyframe || !hasKeyframeProperty(selectedSourceKeyframe, "transform")
    ? "unset"
    : selectedSourceTransforms.length === 0
      ? "none"
      : "explicit";

  return {
    renderTimelines,
    selectedTimelineIndex: nextTimelineIndex,
    selectedKeyframeIndex: nextKeyframeIndex,
    selectedTimeline,
    selectedSourceTimeline,
    selectedKeyframe,
    selectedSourceKeyframe,
    hasSelectedKeyframe,
    opacitySourceState,
    selectedSourceOpacity,
    selectedSourceTransforms,
    selectedTimingFunction,
    transformSourceState,
  };
}

function getRenderTimelines(data: WebKeyframesDocument): RenderWebKeyframesTimeline[] {
  return data.timelines.map((timeline) => ({
    ...timeline,
    positionType: getTimelinePositionType(timeline),
    duration: getTimelinePositionType(timeline) === "time" && Number.isFinite(timeline.duration) && (timeline.duration ?? 0) > 0
      ? Math.round(timeline.duration ?? 1)
      : null,
    translateConfig: {
      unit: timeline.translateConfig?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
    },
    keyframes: timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe)),
  }));
}

export function sanitizeEditorDocument(data: WebKeyframesDocument, defaultTimelineData: WebKeyframesTimeline): WebKeyframesDocument {
  const candidate = data as Partial<WebKeyframesDocument>;
  const timelines = Array.isArray(candidate.timelines) && candidate.timelines.length > 0
    ? candidate.timelines
    : [defaultTimelineData];

  return {
    timelines: timelines.map((timeline, index) => sanitizeEditorTimeline(timeline, index, defaultTimelineData)),
  };
}

function sanitizeEditorTimeline(
  data: Partial<WebKeyframesTimeline>,
  index: number,
  defaultTimelineData: WebKeyframesTimeline,
): WebKeyframesTimeline {
  const fallback = createDefaultTimeline(index, defaultTimelineData);
  const positionType = resolveEditorPositionType(data, fallback.positionType ?? "time");
  const keyframes = Array.isArray(data.keyframes)
    ? data.keyframes
    : fallback.keyframes;
  const resolvedKeyframes = sortKeyframesByPosition(keyframes, positionType)
    .map((keyframe) => cloneSparseKeyframe(keyframe));

  return {
    animationName: typeof data.animationName === "string" && data.animationName.trim() !== ""
      ? data.animationName.trim()
      : fallback.animationName,
    ...(positionType === "percent" || data.positionType === "time" ? { positionType } : {}),
    ...(positionType === "time"
      ? {
          duration: typeof data.duration === "number" && Number.isFinite(data.duration) && data.duration > 0
            ? Math.round(data.duration)
            : fallback.duration,
        }
      : {}),
    translateConfig: {
      unit: isTranslateUnit(data.translateConfig?.unit) ? data.translateConfig.unit : DEFAULT_TRANSLATE_CONFIG.unit,
    },
    keyframes: resolvedKeyframes.map((keyframe) => (
      positionType === "time"
        ? {
            time: typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0,
            timingFunction: keyframe.timingFunction ?? undefined,
            ...(Array.isArray(keyframe.properties) ? { properties: cloneProperties(keyframe.properties) } : {}),
          }
        : {
            percent: typeof keyframe.percent === "number" && Number.isFinite(keyframe.percent) ? keyframe.percent : 0,
            timingFunction: keyframe.timingFunction ?? undefined,
            ...(Array.isArray(keyframe.properties) ? { properties: cloneProperties(keyframe.properties) } : {}),
          }
    )),
  };
}

function createDefaultTimeline(index: number, defaultTimelineData: WebKeyframesTimeline): WebKeyframesTimeline {
  const timeline = cloneTimeline(defaultTimelineData);
  if (index === 0) {
    return timeline;
  }

  timeline.animationName = `${defaultTimelineData.animationName}-${index + 1}`;
  return timeline;
}

export function createNextTimeline(
  timelines: WebKeyframesTimeline[],
  selectedIndex: number,
  defaultTimelineData: WebKeyframesTimeline,
): WebKeyframesTimeline {
  const source = timelines[selectedIndex] ? cloneTimeline(timelines[selectedIndex]) : createDefaultTimeline(timelines.length, defaultTimelineData);
  return {
    animationName: createUniqueTimelineAnimationName(source.animationName, timelines),
    positionType: source.positionType,
    ...(source.positionType !== "percent" && typeof source.duration === "number" ? { duration: source.duration } : {}),
    translateConfig: source.translateConfig ? { ...source.translateConfig } : undefined,
    keyframes: [],
  };
}

export function createDuplicatedTimeline(
  timeline: WebKeyframesTimeline,
  timelines: WebKeyframesTimeline[],
): WebKeyframesTimeline {
  const duplicate = cloneTimeline(timeline);
  duplicate.animationName = createUniqueTimelineAnimationName(`${timeline.animationName}-copy`, timelines);
  return duplicate;
}

function createUniqueTimelineAnimationName(seed: string, timelines: WebKeyframesTimeline[]): string {
  const existing = new Set(timelines.map((timeline) => timeline.animationName));
  if (!existing.has(seed)) {
    return seed;
  }

  let index = 2;
  while (existing.has(`${seed}-${index}`)) {
    index += 1;
  }
  return `${seed}-${index}`;
}

export function cloneSparseKeyframe(keyframe: Partial<WebKeyframe>): WebKeyframe {
  return {
    ...(typeof keyframe.percent === "number" && Number.isFinite(keyframe.percent)
      ? { percent: keyframe.percent }
      : { time: typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0 }),
    ...(typeof keyframe.timingFunction === "string" && keyframe.timingFunction.trim() !== ""
      ? { timingFunction: keyframe.timingFunction.trim() }
      : {}),
    ...(Array.isArray(keyframe.properties) ? { properties: cloneProperties(keyframe.properties) } : {}),
  };
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return clampNumber(Number.isFinite(index) ? Math.round(index) : 0, 0, length - 1);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createNextKeyframe(
  timeline: WebKeyframesTimeline,
  keyframes: WebKeyframesTimeline["keyframes"],
  selectedIndex: number,
): WebKeyframesTimeline["keyframes"][number] {
  const positionType = getTimelinePositionType(timeline);
  const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
  const sortedKeyframes = sortKeyframesByPosition(keyframes, positionType);
  if (sortedKeyframes.length === 0) {
    return createEmptyKeyframe(positionType, 0);
  }

  const selected = sortedKeyframes[selectedIndex] ?? sortedKeyframes[sortedKeyframes.length - 1];
  const next = sortedKeyframes[selectedIndex + 1];
  const previous = sortedKeyframes[selectedIndex - 1];
  const selectedPosition = getEditorKeyframePosition(selected, positionType);
  let position = maxPosition;

  if (sortedKeyframes.length === 1 && selected) {
    position = selectedPosition <= 0 ? maxPosition : 0;
  } else if (selected && next) {
    position = roundEditorPosition((selectedPosition + getEditorKeyframePosition(next, positionType)) / 2, positionType);
  } else if (selected && previous) {
    position = roundEditorPosition(Math.min(maxPosition, (selectedPosition + maxPosition) / 2), positionType);
  } else if (selected) {
    position = Math.min(maxPosition, selectedPosition);
  }

  return createEmptyKeyframe(positionType, position);
}

function createEmptyKeyframe(positionType: KeyframePositionMode, position: number): WebKeyframe {
  return positionType === "time"
    ? { time: position, properties: [] }
    : { percent: position, properties: [] };
}

function sortKeyframesByPosition(
  keyframes: Array<Partial<WebKeyframe>>,
  positionType: KeyframePositionMode,
): Array<Partial<WebKeyframe>> {
  return [...keyframes].sort(
    (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
  );
}

function resolveEditorPositionType(data: Partial<WebKeyframesTimeline>, fallback: KeyframePositionMode): KeyframePositionMode {
  if (data.positionType === "time" || data.positionType === "percent") {
    return data.positionType;
  }

  if (Array.isArray(data.keyframes) && data.keyframes.some((keyframe) => typeof keyframe?.percent === "number")) {
    return "percent";
  }

  return fallback;
}

export function getEditorKeyframePosition(keyframe: Partial<WebKeyframe>, positionType: KeyframePositionMode): number {
  return positionType === "time"
    ? (typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0)
    : (typeof keyframe.percent === "number" && Number.isFinite(keyframe.percent) ? keyframe.percent : 0);
}

export function applyEditorKeyframePosition(keyframe: WebKeyframe, positionType: KeyframePositionMode, value: number): void {
  if (positionType === "time") {
    keyframe.time = Math.round(value);
    delete keyframe.percent;
    return;
  }

  keyframe.percent = roundEditorPosition(value, positionType);
  delete keyframe.time;
}

export function roundEditorPosition(value: number, positionType: KeyframePositionMode): number {
  if (positionType === "time") {
    return Math.round(value);
  }

  return Math.round(value * 10) / 10;
}

function isTranslateUnit(value: unknown): value is TranslateUnit {
  return value === "px" || value === "vw" || value === "vh" || value === "vmin" || value === "vmax" || value === "%" || value === "em" || value === "rem";
}
