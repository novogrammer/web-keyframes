import { addTransform, moveTransform, removeTransform } from "../core/edit.js";
import {
  createDefaultTransform,
  createOpacityProperty,
  createTransformProperty,
  deleteKeyframeProperty,
  hasKeyframeProperty,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type { TransformKind, WebKeyframesTimeline } from "../core/types.js";
import {
  type EditorState,
  applyEditedTransforms,
  setStatus,
  withSelectedKeyframe,
} from "./editorStateController.js";

export class EditorKeyframePropertyController {
  constructor(
    private readonly state: EditorState,
    private readonly defaultTimelineData: WebKeyframesTimeline,
  ) {}

  setTimingFunctionPreset(value: string): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      keyframe.timingFunction = value;
    });
    this.state.pendingFocus = {
      field: "timingFunction",
      index: 0,
      selectionStart: value.length,
      selectionEnd: value.length,
    };
    setStatus(this.state, "info", "Editing timeline data.");
  }

  clearTimingFunction(): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      delete keyframe.timingFunction;
    });
    this.state.pendingFocus = {
      field: "timingFunction",
      index: 0,
      selectionStart: 0,
      selectionEnd: 0,
    };
    setStatus(this.state, "info", "Editing timeline data.");
  }

  moveSelectedTransform(index: number, direction: -1 | 1): void {
    applyEditedTransforms(this.state, this.defaultTimelineData, (timeline) => moveTransform(
      timeline,
      this.state.selectedKeyframeIndex,
      index,
      direction,
    ));
    setStatus(this.state, "info", "Reordered transforms.");
  }

  deleteSelectedTransform(index: number): void {
    applyEditedTransforms(this.state, this.defaultTimelineData, (timeline) => removeTransform(
      timeline,
      this.state.selectedKeyframeIndex,
      index,
    ));
    setStatus(this.state, "info", "Removed transform.");
  }

  addSelectedTransform(kind: TransformKind): void {
    let addedInline = false;
    withSelectedKeyframe(this.state, (_, keyframe) => {
      if (hasKeyframeProperty(keyframe, "transform")) {
        return;
      }

      upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(kind)]));
      addedInline = true;
    });
    if (!addedInline) {
      applyEditedTransforms(this.state, this.defaultTimelineData, (timeline) => addTransform(
        timeline,
        this.state.selectedKeyframeIndex,
        kind,
      ));
    }
    setStatus(this.state, "info", `Added ${kind} transform.`);
  }

  addOpacityProperty(): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      upsertKeyframeProperty(keyframe, createOpacityProperty(1));
    });
    setStatus(this.state, "info", "Added opacity to the selected keyframe.");
  }

  deleteOpacityProperty(): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      deleteKeyframeProperty(keyframe, "opacity");
    });
    setStatus(this.state, "info", "Deleted opacity from the selected keyframe.");
  }

  deleteTransformProperty(): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      deleteKeyframeProperty(keyframe, "transform");
    });
    setStatus(this.state, "info", "Deleted transforms from the selected keyframe.");
  }

  clearTransformProperty(): void {
    withSelectedKeyframe(this.state, (_, keyframe) => {
      upsertKeyframeProperty(keyframe, createTransformProperty([]));
    });
    setStatus(this.state, "info", "Cleared transforms to none for the selected keyframe.");
  }
}
