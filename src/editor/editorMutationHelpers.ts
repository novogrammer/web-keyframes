import {
  createOpacityProperty,
  DEFAULT_TRANSLATE_CONFIG,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type {
  KeyframePositionMode,
  TranslateUnit,
  WebKeyframe,
  WebKeyframesTimeline,
} from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampNumber,
  cloneSparseKeyframe,
} from "./editorModel.js";

export function applyTimelineDuration(timeline: WebKeyframesTimeline, value: number): void {
  if (timeline.positionType === "percent") {
    return;
  }

  timeline.duration = Math.max(1, Math.round(value));
  clampTimelineKeyframesToDuration(timeline);
}

export function applyTimelinePositionType(
  timeline: WebKeyframesTimeline,
  nextPositionType: KeyframePositionMode,
  options: {
    fallbackPercentDuration: number;
    fallbackTimeDuration: number;
  },
): void {
  if (nextPositionType === timeline.positionType) {
    return;
  }

  if (nextPositionType === "percent") {
    convertTimelineKeyframesToPercent(timeline, options.fallbackPercentDuration);
    return;
  }

  convertTimelineKeyframesToTime(timeline, options.fallbackTimeDuration);
}

export function applyTimelineTranslateUnit(timeline: WebKeyframesTimeline, unit: TranslateUnit): void {
  timeline.translateConfig = {
    ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
    unit,
  };
}

export function applyTimelineTranslateCustomUnit(timeline: WebKeyframesTimeline, customUnit: string): void {
  timeline.translateConfig = {
    ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
    customUnit,
  };
}

export function applyKeyframeTimingFunction(keyframe: WebKeyframe, value: string): void {
  const trimmed = value.trim();
  if (trimmed === "") {
    delete keyframe.timingFunction;
    return;
  }

  keyframe.timingFunction = trimmed;
}

export function applyKeyframeOpacity(keyframe: WebKeyframe, value: number): void {
  upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
}

function convertTimelineKeyframesToPercent(timeline: WebKeyframesTimeline, fallbackDuration: number): void {
  const duration = Math.max(timeline.duration ?? fallbackDuration, 1);
  timeline.positionType = "percent";
  delete timeline.duration;
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = cloneSparseKeyframe(keyframe);
    const percent = typeof nextKeyframe.time === "number" ? (nextKeyframe.time / duration) * 100 : 0;
    applyEditorKeyframePosition(nextKeyframe, "percent", clampNumber(percent, 0, 100));
    return nextKeyframe;
  });
}

function convertTimelineKeyframesToTime(timeline: WebKeyframesTimeline, nextDuration: number): void {
  timeline.positionType = "time";
  timeline.duration = Math.max(1, Math.round(nextDuration));
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = cloneSparseKeyframe(keyframe);
    const percent = typeof nextKeyframe.percent === "number" ? nextKeyframe.percent : 0;
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(Math.round((percent / 100) * (timeline.duration ?? 1)), 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}

function clampTimelineKeyframesToDuration(timeline: WebKeyframesTimeline): void {
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = cloneSparseKeyframe(keyframe);
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(typeof nextKeyframe.time === "number" ? nextKeyframe.time : 0, 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}
