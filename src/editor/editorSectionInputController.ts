import {
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/edit.js";
import {
  createOpacityProperty,
  DEFAULT_TRANSLATE_CONFIG,
  deleteKeyframeProperty,
  getTimelinePositionType,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type { TransformKind, TranslateUnit, WebKeyframesTimeline } from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampNumber,
  getEditorKeyframePosition,
  roundEditorPosition,
} from "./editorModel.js";
import {
  type EditorState,
  applyEditedTransforms,
  normalizeEditorState,
  setStatus,
  updateSelectedTimeline,
  updateSelectedTimelineKeyframes,
  withSelectedKeyframe,
} from "./editorStateController.js";

export function createEditorSectionInputController(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
): {
  applyStringField: (field: string, value: string) => boolean;
  applyNumberField: (field: string, value: number) => boolean;
} {
  return {
    applyStringField: (field, value) => {
      return applyTimelineStringField(state, defaultTimelineData, field, value)
        || applyKeyframeStringField(state, field, value)
        || applyTransformStringField(state, defaultTimelineData, field, value);
    },
    applyNumberField: (field, value) => {
      return applyTimelineNumberField(state, defaultTimelineData, field, value)
        || applyKeyframeNumberField(state, defaultTimelineData, field, value)
        || applyTransformNumberField(state, defaultTimelineData, field, value);
    },
  };
}

function applyTimelineStringField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: string,
): boolean {
  switch (field) {
    case "id":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        timeline.id = value;
      });
      return true;
    case "positionType":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        const nextPositionType = value === "percent" ? "percent" : "time";
        if (nextPositionType === timeline.positionType) {
          return;
        }

        if (nextPositionType === "percent") {
          convertTimelineKeyframesToPercent(timeline, defaultTimelineData.duration ?? 1);
          return;
        }

        convertTimelineKeyframesToTime(timeline, defaultTimelineData.duration ?? 1200);
      });
      normalizeEditorState(state, defaultTimelineData);
      return true;
    case "translateCustomUnit":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        timeline.translateConfig = {
          ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
          customUnit: value,
        };
      });
      return true;
    case "translateUnit":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        timeline.translateConfig = {
          ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
          unit: value as TranslateUnit,
        };
      });
      return true;
    default:
      return false;
  }
}

function applyKeyframeStringField(state: EditorState, field: string, value: string): boolean {
  if (field !== "timingFunction") {
    return false;
  }

  withSelectedKeyframe(state, (_, keyframe) => {
    const trimmed = value.trim();
    if (trimmed === "") {
      delete keyframe.timingFunction;
    } else {
      keyframe.timingFunction = trimmed;
    }
  });
  return true;
}

function applyTransformStringField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: string,
): boolean {
  if (!field.startsWith("transform-kind-")) {
    return false;
  }

  const index = Number(field.slice("transform-kind-".length));
  applyEditedTransforms(state, defaultTimelineData, (timeline) =>
    replaceTransformKind(timeline, state.selectedKeyframeIndex, index, value as TransformKind)
  );
  return true;
}

function applyTimelineNumberField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: number,
): boolean {
  switch (field) {
    case "duration":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        if (timeline.positionType === "percent") {
          return;
        }

        timeline.duration = Math.max(1, Math.round(value));
        clampTimelineKeyframesToDuration(timeline);
      });
      normalizeEditorState(state, defaultTimelineData);
      return true;
    default:
      return false;
  }
}

function applyKeyframeNumberField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: number,
): boolean {
  switch (field) {
    case "position":
      updateSelectedTimelineKeyframes(state, defaultTimelineData, (keyframes, timeline) => {
        const selected = keyframes[state.selectedKeyframeIndex];
        if (!selected) {
          return;
        }

        const positionType = getTimelinePositionType(timeline);
        const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
        applyEditorKeyframePosition(selected, positionType, clampNumber(roundEditorPosition(value, positionType), 0, maxPosition));
        keyframes.splice(0, keyframes.length, ...keyframes.sort(
          (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
        ));
        state.selectedKeyframeIndex = keyframes.indexOf(selected);
      });
      return true;
    case "opacity":
      withSelectedKeyframe(state, (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
      });
      return true;
    default:
      return false;
  }
}

function applyTransformNumberField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: number,
): boolean {
  const match = /^transform-(x|y|value)-(\d+)$/.exec(field);
  if (!match) {
    return false;
  }

  const transformField = match[1] as "x" | "y" | "value";
  const index = Number(match[2]);
  applyEditedTransforms(state, defaultTimelineData, (timeline) =>
    setTransformFieldValue(timeline, state.selectedKeyframeIndex, index, transformField, value)
  );
  return true;
}

function convertTimelineKeyframesToPercent(timeline: WebKeyframesTimeline, fallbackDuration: number): void {
  const duration = Math.max(timeline.duration ?? fallbackDuration, 1);
  timeline.positionType = "percent";
  delete timeline.duration;
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };
    const percent = typeof nextKeyframe.time === "number" ? (nextKeyframe.time / duration) * 100 : 0;
    applyEditorKeyframePosition(nextKeyframe, "percent", clampNumber(percent, 0, 100));
    return nextKeyframe;
  });
}

function convertTimelineKeyframesToTime(timeline: WebKeyframesTimeline, nextDuration: number): void {
  timeline.positionType = "time";
  timeline.duration = Math.max(1, Math.round(nextDuration));
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };
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
    const nextKeyframe = { ...keyframe };
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(typeof nextKeyframe.time === "number" ? nextKeyframe.time : 0, 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}
