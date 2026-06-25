import {
  addTransform,
  moveTransform,
  removeTransform,
} from "../core/edit.js";
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

export function createEditorKeyframePropertyController(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
): {
  setTimingFunctionPreset: (value: string) => void;
  clearTimingFunction: () => void;
  moveSelectedTransform: (index: number, direction: -1 | 1) => void;
  deleteSelectedTransform: (index: number) => void;
  addSelectedTransform: (kind: TransformKind) => void;
  addOpacityProperty: () => void;
  deleteOpacityProperty: () => void;
  deleteTransformProperty: () => void;
  clearTransformProperty: () => void;
} {
  return {
    setTimingFunctionPreset: (value) => {
      withSelectedKeyframe(state, (_, keyframe) => {
        keyframe.timingFunction = value;
      });
      state.pendingFocus = {
        field: "timingFunction",
        index: 0,
        selectionStart: value.length,
        selectionEnd: value.length,
      };
      setStatus(state, "info", "Editing timeline data.");
    },
    clearTimingFunction: () => {
      withSelectedKeyframe(state, (_, keyframe) => {
        delete keyframe.timingFunction;
      });
      state.pendingFocus = {
        field: "timingFunction",
        index: 0,
        selectionStart: 0,
        selectionEnd: 0,
      };
      setStatus(state, "info", "Editing timeline data.");
    },
    moveSelectedTransform: (index, direction) => {
      applyEditedTransforms(state, defaultTimelineData, (timeline) => moveTransform(
        timeline,
        state.selectedKeyframeIndex,
        index,
        direction,
      ));
      setStatus(state, "info", "Reordered transforms.");
    },
    deleteSelectedTransform: (index) => {
      applyEditedTransforms(state, defaultTimelineData, (timeline) => removeTransform(
        timeline,
        state.selectedKeyframeIndex,
        index,
      ));
      setStatus(state, "info", "Removed transform.");
    },
    addSelectedTransform: (kind) => {
      let addedInline = false;
      withSelectedKeyframe(state, (_, keyframe) => {
        if (hasKeyframeProperty(keyframe, "transform")) {
          return;
        }

        upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(kind)]));
        addedInline = true;
      });
      if (!addedInline) {
        applyEditedTransforms(state, defaultTimelineData, (timeline) => addTransform(
          timeline,
          state.selectedKeyframeIndex,
          kind,
        ));
      }
      setStatus(state, "info", `Added ${kind} transform.`);
    },
    addOpacityProperty: () => {
      withSelectedKeyframe(state, (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(1));
      });
      setStatus(state, "info", "Added opacity to the selected keyframe.");
    },
    deleteOpacityProperty: () => {
      withSelectedKeyframe(state, (_, keyframe) => {
        deleteKeyframeProperty(keyframe, "opacity");
      });
      setStatus(state, "info", "Deleted opacity from the selected keyframe.");
    },
    deleteTransformProperty: () => {
      withSelectedKeyframe(state, (_, keyframe) => {
        deleteKeyframeProperty(keyframe, "transform");
      });
      setStatus(state, "info", "Deleted transforms from the selected keyframe.");
    },
    clearTransformProperty: () => {
      withSelectedKeyframe(state, (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createTransformProperty([]));
      });
      setStatus(state, "info", "Cleared transforms to none for the selected keyframe.");
    },
  };
}
