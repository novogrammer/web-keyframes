import { cloneTimeline } from "../core/normalize.js";
import { getTimelinePositionType } from "../core/normalize.js";
import type { WebKeyframesTimeline } from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampIndex,
  clampNumber,
  cloneSparseKeyframe,
  createDuplicatedTimeline,
  createNextKeyframe,
  createNextTimeline,
  getEditorKeyframePosition,
  roundEditorPosition,
  sanitizeEditorDocument,
} from "./editorModel.js";
import {
  type EditorState,
  getSelectedTimeline,
  normalizeEditorState,
  setStatus,
  sortKeyframesByPosition,
  updateSelectedTimeline,
} from "./editorStateController.js";

export function createEditorCollectionController(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
): {
  addTimeline: () => void;
  duplicateTimeline: () => void;
  deleteTimeline: () => void;
  addKeyframe: () => void;
  deleteKeyframe: () => void;
  duplicateKeyframe: () => void;
} {
  return {
    addTimeline: () => {
      const nextTimeline = createNextTimeline(state.data.timelines, state.selectedTimelineIndex, defaultTimelineData);
      state.data = sanitizeEditorDocument({
        timelines: [...state.data.timelines, nextTimeline],
      }, defaultTimelineData);
      state.selectedTimelineIndex = state.data.timelines.findIndex((timeline) => timeline.id === nextTimeline.id);
      state.selectedKeyframeIndex = 0;
      setStatus(state, "info", "Added timeline.");
    },
    duplicateTimeline: () => {
      const source = getSelectedTimeline(state);
      const duplicate = createDuplicatedTimeline(source, state.data.timelines);
      const timelines = state.data.timelines.map((timeline) => cloneTimeline(timeline));
      timelines.splice(state.selectedTimelineIndex + 1, 0, duplicate);
      state.data = sanitizeEditorDocument({ timelines }, defaultTimelineData);
      state.selectedTimelineIndex = state.selectedTimelineIndex + 1;
      normalizeEditorState(state, defaultTimelineData);
      setStatus(state, "info", "Duplicated timeline.");
    },
    deleteTimeline: () => {
      if (state.data.timelines.length <= 1) {
        return;
      }

      const timelines = state.data.timelines.filter((_, index) => index !== state.selectedTimelineIndex);
      state.data = sanitizeEditorDocument({ timelines }, defaultTimelineData);
      normalizeEditorState(state, defaultTimelineData);
      setStatus(state, "info", "Deleted timeline.");
    },
    addKeyframe: () => {
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        const positionType = getTimelinePositionType(timeline);
        const nextFrame = createNextKeyframe(timeline, timeline.keyframes, state.selectedKeyframeIndex);
        timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, nextFrame], positionType);
        state.selectedKeyframeIndex = timeline.keyframes.indexOf(nextFrame);
      });
    },
    deleteKeyframe: () => {
      const timeline = getSelectedTimeline(state);
      if (timeline.keyframes.length === 0) {
        return;
      }

      updateSelectedTimeline(state, defaultTimelineData, (candidate) => {
        candidate.keyframes = candidate.keyframes.filter((_, index) => index !== state.selectedKeyframeIndex);
        state.selectedKeyframeIndex = clampIndex(state.selectedKeyframeIndex, candidate.keyframes.length);
      });
    },
    duplicateKeyframe: () => {
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        const positionType = getTimelinePositionType(timeline);
        const source = timeline.keyframes[state.selectedKeyframeIndex];
        if (!source) {
          return;
        }

        const duplicate = cloneSparseKeyframe(source);
        const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
        const offset = positionType === "time"
          ? Math.max(1, Math.round((timeline.duration ?? 1) * 0.1))
          : 10;
        const nextPosition = Math.min(maxPosition, getEditorKeyframePosition(source, positionType) + offset);
        applyEditorKeyframePosition(duplicate, positionType, clampNumber(roundEditorPosition(nextPosition, positionType), 0, maxPosition));
        timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, duplicate], positionType);
        state.selectedKeyframeIndex = timeline.keyframes.indexOf(duplicate);
      });
      setStatus(state, "info", "Duplicated selected keyframe.");
    },
  };
}
