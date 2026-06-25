import { getTimelinePositionType } from "../core/normalize.js";
import type { WebKeyframesTimeline } from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampIndex,
  clampNumber,
  cloneSparseKeyframe,
  createNextKeyframe,
  getEditorKeyframePosition,
  roundEditorPosition,
} from "./editorModel.js";
import {
  type EditorState,
  getSelectedTimeline,
  setStatus,
  sortKeyframesByPosition,
  updateSelectedTimeline,
} from "./editorStateController.js";

export class EditorKeyframeCollectionController {
  constructor(
    private readonly state: EditorState,
    private readonly defaultTimelineData: WebKeyframesTimeline,
  ) {}

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
