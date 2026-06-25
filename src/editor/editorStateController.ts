import { cloneTimeline, getTimelinePositionType } from "../core/normalize.js";
import type {
  NormalizedWebKeyframesTimeline,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/types.js";
import {
  cloneSparseKeyframe,
  getEditorKeyframePosition,
} from "./editorModel.js";

type StatusTone = "info" | "success" | "error";

type EditorStateControllerOptions = {
  getData: () => WebKeyframesDocument;
  getSelectedTimelineIndex: () => number;
  setSelectedTimelineIndex: (index: number) => void;
  getSelectedKeyframeIndex: () => number;
  setSelectedKeyframeIndex: (index: number) => void;
  normalizeEditorState: () => void;
  render: () => void;
  setStatus: (tone: StatusTone, message: string) => void;
};

export class EditorStateController {
  private readonly getDataState: () => WebKeyframesDocument;
  private readonly getSelectedTimelineIndexState: () => number;
  private readonly setSelectedTimelineIndexState: (index: number) => void;
  private readonly getSelectedKeyframeIndexState: () => number;
  private readonly setSelectedKeyframeIndexState: (index: number) => void;
  private readonly normalizeEditorStateCallback: () => void;
  private readonly renderCallback: () => void;
  private readonly setStatusCallback: (tone: StatusTone, message: string) => void;

  constructor(options: EditorStateControllerOptions) {
    this.getDataState = options.getData;
    this.getSelectedTimelineIndexState = options.getSelectedTimelineIndex;
    this.setSelectedTimelineIndexState = options.setSelectedTimelineIndex;
    this.getSelectedKeyframeIndexState = options.getSelectedKeyframeIndex;
    this.setSelectedKeyframeIndexState = options.setSelectedKeyframeIndex;
    this.normalizeEditorStateCallback = options.normalizeEditorState;
    this.renderCallback = options.render;
    this.setStatusCallback = options.setStatus;
  }

  getSelectedTimeline(): WebKeyframesTimeline {
    const data = this.getDataState();
    return data.timelines[this.getSelectedTimelineIndexState()] ?? data.timelines[0];
  }

  getSelectedKeyframeIndex(): number {
    return this.getSelectedKeyframeIndexState();
  }

  setSelectedKeyframeIndex(index: number): void {
    this.setSelectedKeyframeIndexState(index);
  }

  updateSelectedTimeline(update: (timeline: WebKeyframesTimeline) => void): void {
    const timeline = this.getSelectedTimeline();
    update(timeline);
    this.normalizeEditorStateCallback();
  }

  updateSelectedTimelineKeyframes(
    update: (keyframes: WebKeyframe[], timeline: WebKeyframesTimeline) => void,
    shouldRender = true,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframes = timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));

    update(keyframes, timeline);
    timeline.keyframes = keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));
    this.normalizeEditorStateCallback();
    this.setStatusCallback("info", "Editing timeline data.");
    if (shouldRender) {
      this.renderCallback();
    }
  }

  commitEditorChange(
    update: () => void,
    options: {
      status?: { tone: StatusTone; message: string };
      render?: boolean;
    } = {},
  ): void {
    update();
    if (options.status) {
      this.setStatusCallback(options.status.tone, options.status.message);
    }
    if (options.render ?? true) {
      this.renderCallback();
    }
  }

  withSelectedKeyframe(
    run: (timeline: WebKeyframesTimeline, keyframe: WebKeyframe) => void,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframe = timeline.keyframes[this.getSelectedKeyframeIndexState()];
    if (!keyframe) {
      return;
    }

    run(timeline, keyframe);
  }

  applyEditedTransforms(
    edit: (timeline: WebKeyframesTimeline) => WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
  ): void {
    this.updateSelectedTimeline((timeline) => {
      timeline.keyframes = cloneTimeline(edit(timeline)).keyframes;
    });
  }

  sortKeyframesByPosition(
    keyframes: WebKeyframe[],
    positionType: ReturnType<typeof getTimelinePositionType>,
  ): WebKeyframe[] {
    return [...keyframes].sort(
      (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
    );
  }
}
