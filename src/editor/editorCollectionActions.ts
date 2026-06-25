import { cloneTimeline, getTimelinePositionType } from "../core/normalize.js";
import type { WebKeyframe, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampIndex,
  cloneSparseKeyframe,
  createDuplicatedTimeline,
  createNextKeyframe,
  createNextTimeline,
  getEditorKeyframePosition,
  roundEditorPosition,
  sanitizeEditorDocument,
} from "./editorModel.js";

export function selectTimelineIndex(data: WebKeyframesDocument, index: number): number {
  return clampIndex(index, data.timelines.length);
}

export function selectKeyframeIndex(timeline: WebKeyframesTimeline, index: number): number {
  return clampIndex(index, timeline.keyframes.length);
}

export function addTimeline(
  data: WebKeyframesDocument,
  selectedTimelineIndex: number,
  defaultTimelineData: WebKeyframesTimeline,
): {
  data: WebKeyframesDocument;
  selectedTimelineIndex: number;
  selectedKeyframeIndex: number;
} {
  const nextTimeline = createNextTimeline(data.timelines, selectedTimelineIndex, defaultTimelineData);
  const nextData = sanitizeEditorDocument({
    timelines: [...data.timelines, nextTimeline],
  }, defaultTimelineData);

  return {
    data: nextData,
    selectedTimelineIndex: nextData.timelines.findIndex((timeline) => timeline.id === nextTimeline.id),
    selectedKeyframeIndex: 0,
  };
}

export function duplicateTimeline(
  data: WebKeyframesDocument,
  selectedTimelineIndex: number,
  defaultTimelineData: WebKeyframesTimeline,
): {
  data: WebKeyframesDocument;
  selectedTimelineIndex: number;
} {
  const source = data.timelines[selectedTimelineIndex] ?? data.timelines[0] ?? cloneTimeline(defaultTimelineData);
  const duplicate = createDuplicatedTimeline(source, data.timelines);
  const timelines = data.timelines.map((timeline) => cloneTimeline(timeline));
  timelines.splice(selectedTimelineIndex + 1, 0, duplicate);

  return {
    data: sanitizeEditorDocument({ timelines }, defaultTimelineData),
    selectedTimelineIndex: selectedTimelineIndex + 1,
  };
}

export function deleteTimeline(
  data: WebKeyframesDocument,
  selectedTimelineIndex: number,
  defaultTimelineData: WebKeyframesTimeline,
): {
  data: WebKeyframesDocument;
} {
  const timelines = data.timelines.filter((_, index) => index !== selectedTimelineIndex);
  return {
    data: sanitizeEditorDocument({ timelines }, defaultTimelineData),
  };
}

export function addKeyframe(
  timeline: WebKeyframesTimeline,
  selectedKeyframeIndex: number,
  sortKeyframesByPosition: (keyframes: WebKeyframe[], positionType: ReturnType<typeof getTimelinePositionType>) => WebKeyframe[],
): {
  timeline: WebKeyframesTimeline;
  selectedKeyframeIndex: number;
} {
  const nextTimeline = cloneTimeline(timeline);
  const positionType = getTimelinePositionType(nextTimeline);
  const nextFrame = createNextKeyframe(nextTimeline, nextTimeline.keyframes, selectedKeyframeIndex);
  nextTimeline.keyframes = sortKeyframesByPosition([...nextTimeline.keyframes, nextFrame], positionType);

  return {
    timeline: nextTimeline,
    selectedKeyframeIndex: nextTimeline.keyframes.indexOf(nextFrame),
  };
}

export function deleteKeyframe(
  timeline: WebKeyframesTimeline,
  selectedKeyframeIndex: number,
): {
  timeline: WebKeyframesTimeline;
  selectedKeyframeIndex: number;
} {
  const nextTimeline = cloneTimeline(timeline);
  nextTimeline.keyframes = nextTimeline.keyframes.filter((_, index) => index !== selectedKeyframeIndex);

  return {
    timeline: nextTimeline,
    selectedKeyframeIndex: clampIndex(selectedKeyframeIndex, nextTimeline.keyframes.length),
  };
}

export function duplicateKeyframe(
  timeline: WebKeyframesTimeline,
  selectedKeyframeIndex: number,
  sortKeyframesByPosition: (keyframes: WebKeyframe[], positionType: ReturnType<typeof getTimelinePositionType>) => WebKeyframe[],
): {
  timeline: WebKeyframesTimeline;
  selectedKeyframeIndex: number;
} | null {
  const nextTimeline = cloneTimeline(timeline);
  const positionType = getTimelinePositionType(nextTimeline);
  const source = nextTimeline.keyframes[selectedKeyframeIndex];
  if (!source) {
    return null;
  }

  const duplicate = cloneSparseKeyframe(source);
  const maxPosition = positionType === "time" ? Math.max(nextTimeline.duration ?? 1, 1) : 100;
  const offset = positionType === "time"
    ? Math.max(1, Math.round((nextTimeline.duration ?? 1) * 0.1))
    : 10;
  const nextPosition = Math.min(maxPosition, getEditorKeyframePosition(source, positionType) + offset);
  applyEditorKeyframePosition(duplicate, positionType, roundEditorPosition(nextPosition, positionType));
  nextTimeline.keyframes = sortKeyframesByPosition([...nextTimeline.keyframes, duplicate], positionType);

  return {
    timeline: nextTimeline,
    selectedKeyframeIndex: nextTimeline.keyframes.indexOf(duplicate),
  };
}
