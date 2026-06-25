import { cloneTimeline, getTimelinePositionType } from "../core/normalize.js";
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

export class EditorCollectionController {
  constructor(
    private readonly state: EditorState,
    private readonly defaultTimelineData: WebKeyframesTimeline,
  ) {}

  addTimeline(): void {
    const nextTimeline = createNextTimeline(
      this.state.data.timelines,
      this.state.selectedTimelineIndex,
      this.defaultTimelineData,
    );
    this.state.data = sanitizeEditorDocument({
      timelines: [...this.state.data.timelines, nextTimeline],
    }, this.defaultTimelineData);
    this.state.selectedTimelineIndex = this.state.data.timelines.findIndex((timeline) => timeline.id === nextTimeline.id);
    this.state.selectedKeyframeIndex = 0;
    setStatus(this.state, "info", "Added timeline.");
  }

  duplicateTimeline(): void {
    const source = getSelectedTimeline(this.state);
    const duplicate = createDuplicatedTimeline(source, this.state.data.timelines);
    const timelines = this.state.data.timelines.map((timeline) => cloneTimeline(timeline));
    timelines.splice(this.state.selectedTimelineIndex + 1, 0, duplicate);
    this.state.data = sanitizeEditorDocument({ timelines }, this.defaultTimelineData);
    this.state.selectedTimelineIndex = this.state.selectedTimelineIndex + 1;
    normalizeEditorState(this.state, this.defaultTimelineData);
    setStatus(this.state, "info", "Duplicated timeline.");
  }

  deleteTimeline(): void {
    if (this.state.data.timelines.length <= 1) {
      return;
    }

    const timelines = this.state.data.timelines.filter((_, index) => index !== this.state.selectedTimelineIndex);
    this.state.data = sanitizeEditorDocument({ timelines }, this.defaultTimelineData);
    normalizeEditorState(this.state, this.defaultTimelineData);
    setStatus(this.state, "info", "Deleted timeline.");
  }

  addKeyframe(): void {
    updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
      const positionType = getTimelinePositionType(timeline);
      const nextFrame = createNextKeyframe(timeline, timeline.keyframes, this.state.selectedKeyframeIndex);
      timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, nextFrame], positionType);
      this.state.selectedKeyframeIndex = timeline.keyframes.indexOf(nextFrame);
    });
  }

  deleteKeyframe(): void {
    const timeline = getSelectedTimeline(this.state);
    if (timeline.keyframes.length === 0) {
      return;
    }

    updateSelectedTimeline(this.state, this.defaultTimelineData, (candidate) => {
      candidate.keyframes = candidate.keyframes.filter((_, index) => index !== this.state.selectedKeyframeIndex);
      this.state.selectedKeyframeIndex = clampIndex(this.state.selectedKeyframeIndex, candidate.keyframes.length);
    });
  }

  duplicateKeyframe(): void {
    updateSelectedTimeline(this.state, this.defaultTimelineData, (timeline) => {
      const positionType = getTimelinePositionType(timeline);
      const source = timeline.keyframes[this.state.selectedKeyframeIndex];
      if (!source) {
        return;
      }

      const duplicate = cloneSparseKeyframe(source);
      const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
      const offset = positionType === "time"
        ? Math.max(1, Math.round((timeline.duration ?? 1) * 0.1))
        : 10;
      const nextPosition = Math.min(maxPosition, getEditorKeyframePosition(source, positionType) + offset);
      applyEditorKeyframePosition(
        duplicate,
        positionType,
        clampNumber(roundEditorPosition(nextPosition, positionType), 0, maxPosition),
      );
      timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, duplicate], positionType);
      this.state.selectedKeyframeIndex = timeline.keyframes.indexOf(duplicate);
    });
    setStatus(this.state, "info", "Duplicated selected keyframe.");
  }
}
