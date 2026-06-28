import { replaceTransformKind, setTransformFieldValue } from "../../core/edit.js";
import {
  createOpacityProperty,
  DEFAULT_TRANSLATE_CONFIG,
  getTimelinePositionType,
  upsertKeyframeProperty,
} from "../../core/normalize.js";
import type { TransformKind, TranslateUnit, WebKeyframesTimeline } from "../../core/types.js";
import {
  applyEditorKeyframePosition,
  clampNumber,
  getEditorKeyframePosition,
  roundEditorPosition,
} from "../editorModel.js";
import {
  type EditorState,
  applyEditedTransforms,
  normalizeEditorState,
  updateSelectedTimeline,
  updateSelectedTimelineKeyframes,
  withSelectedKeyframe,
} from "../editorStateController.js";

export class EditorSectionInputController {
  constructor(
    private readonly state: EditorState,
    private readonly defaultTimelineData: WebKeyframesTimeline,
  ) {}

  applyStringField(field: string, value: string): boolean {
    return this.applyTimelineStringField(field, value)
      || this.applyKeyframeStringField(field, value)
      || this.applyTransformStringField(field, value);
  }

  applyNumberField(field: string, value: number): boolean {
    return this.applyTimelineNumberField(field, value)
      || this.applyKeyframeNumberField(field, value)
      || this.applyTransformNumberField(field, value);
  }

  private applyTimelineStringField(field: string, value: string): boolean {
    switch (field) {
      case "animationName":
        updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
          timeline.animationName = value;
        });
        return true;
      case "positionType":
        updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
          const nextPositionType = value === "percent" ? "percent" : "time";
          if (nextPositionType === timeline.positionType) {
            return;
          }

          if (nextPositionType === "percent") {
            convertTimelineKeyframesToPercent(timeline, this.defaultTimelineData.duration ?? 1);
            return;
          }

          convertTimelineKeyframesToTime(timeline, this.defaultTimelineData.duration ?? 1200);
        });
        normalizeEditorState(this.state, this.defaultTimelineData);
        return true;
      case "translateUnit":
        updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
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

  private applyKeyframeStringField(field: string, value: string): boolean {
    if (field !== "timingFunction") {
      return false;
    }

    withSelectedKeyframe(this.state, (_, keyframe) => {
      const trimmed = value.trim();
      if (trimmed === "") {
        delete keyframe.timingFunction;
      } else {
        keyframe.timingFunction = trimmed;
      }
    });
    return true;
  }

  private applyTransformStringField(field: string, value: string): boolean {
    if (!field.startsWith("transform-kind-")) {
      return false;
    }

    const index = Number(field.slice("transform-kind-".length));
    applyEditedTransforms(this.state, this.defaultTimelineData, (timeline) =>
      replaceTransformKind(timeline, this.state.selectedKeyframeIndex, index, value as TransformKind)
    );
    return true;
  }

  private applyTimelineNumberField(field: string, value: number): boolean {
    switch (field) {
      case "duration":
        updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
          if (timeline.positionType === "percent") {
            return;
          }

          timeline.duration = Math.max(1, Math.round(value));
          clampTimelineKeyframesToDuration(timeline);
        });
        normalizeEditorState(this.state, this.defaultTimelineData);
        return true;
      default:
        return false;
    }
  }

  private applyKeyframeNumberField(field: string, value: number): boolean {
    switch (field) {
      case "position":
        updateSelectedTimelineKeyframes(this.state, this.defaultTimelineData, (keyframes, timeline) => {
          const selected = keyframes[this.state.selectedKeyframeIndex];
          if (!selected) {
            return;
          }

          const positionType = getTimelinePositionType(timeline);
          const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
          applyEditorKeyframePosition(
            selected,
            positionType,
            clampNumber(roundEditorPosition(value, positionType), 0, maxPosition),
          );
          keyframes.splice(0, keyframes.length, ...keyframes.sort(
            (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
          ));
          this.state.selectedKeyframeIndex = keyframes.indexOf(selected);
        });
        return true;
      case "opacity":
        withSelectedKeyframe(this.state, (_, keyframe) => {
          upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
        });
        return true;
      default:
        return false;
    }
  }

  private applyTransformNumberField(field: string, value: number): boolean {
    const match = /^transform-(x|y|value)-(\d+)$/.exec(field);
    if (!match) {
      return false;
    }

    const transformField = match[1] as "x" | "y" | "value";
    const index = Number(match[2]);
    applyEditedTransforms(this.state, this.defaultTimelineData, (timeline) =>
      setTransformFieldValue(timeline, this.state.selectedKeyframeIndex, index, transformField, value)
    );
    return true;
  }
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
