import { cloneTimeline } from "../core/normalize.js";
import type { WebKeyframesTimeline } from "../core/types.js";
import {
  createDuplicatedTimeline,
  createNextTimeline,
  sanitizeEditorDocument,
} from "./editorModel.js";
import {
  type EditorState,
  getSelectedTimeline,
  normalizeEditorState,
  setStatus,
} from "./editorStateController.js";

export class EditorTimelineCollectionController {
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
}
