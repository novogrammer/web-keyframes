import {
  moveTransform,
  removeTransform,
} from "../core/edit.js";
import { cloneTimeline } from "../core/normalize.js";
import type { TransformKind } from "../core/types.js";
import { EditorInputController } from "./editorInputController.js";
import {
  addKeyframeTransform,
  clearKeyframeTimingFunction,
  clearKeyframeTransforms,
  deleteKeyframeOpacity,
  deleteKeyframeTransforms,
  ensureKeyframeOpacity,
  setKeyframeTimingFunction,
} from "./editorKeyframePropertyActions.js";
import { EditorStateController } from "./editorStateController.js";

type StatusTone = "info" | "success" | "error";

type EditorKeyframePropertyControllerOptions = {
  getSelectedKeyframeIndex: () => number;
  stateController: EditorStateController;
  inputController: EditorInputController;
};

export class EditorKeyframePropertyController {
  private readonly getSelectedKeyframeIndexState: () => number;
  private readonly stateController: EditorStateController;
  private readonly inputController: EditorInputController;

  constructor(options: EditorKeyframePropertyControllerOptions) {
    this.getSelectedKeyframeIndexState = options.getSelectedKeyframeIndex;
    this.stateController = options.stateController;
    this.inputController = options.inputController;
  }

  setTimingFunctionPreset(value: string): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        setKeyframeTimingFunction(keyframe, value);
      });
      this.inputController.setPendingFocus({
        field: "timingFunction",
        index: 0,
        selectionStart: value.length,
        selectionEnd: value.length,
      });
    }, { status: { tone: "info", message: "Editing timeline data." } });
  }

  clearTimingFunction(): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        clearKeyframeTimingFunction(keyframe);
      });
      this.inputController.setPendingFocus({
        field: "timingFunction",
        index: 0,
        selectionStart: 0,
        selectionEnd: 0,
      });
    }, { status: { tone: "info", message: "Editing timeline data." } });
  }

  moveSelectedTransform(index: number, direction: -1 | 1): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.applyEditedTransforms((timeline) => moveTransform(
        timeline,
        this.getSelectedKeyframeIndexState(),
        index,
        direction,
      ));
    }, { status: { tone: "info", message: "Reordered transforms." } });
  }

  deleteSelectedTransform(index: number): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.applyEditedTransforms((timeline) => removeTransform(
        timeline,
        this.getSelectedKeyframeIndexState(),
        index,
      ));
    }, { status: { tone: "info", message: "Removed transform." } });
  }

  addSelectedTransform(kind: TransformKind): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((timeline, keyframe) => {
        const nextTimeline = addKeyframeTransform(timeline, this.getSelectedKeyframeIndexState(), keyframe, kind);
        if (nextTimeline) {
          timeline.keyframes = cloneTimeline(nextTimeline).keyframes;
        }
      });
    }, { status: { tone: "info", message: `Added ${kind} transform.` } });
  }

  addOpacityProperty(): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        ensureKeyframeOpacity(keyframe, 1);
      });
    }, { status: { tone: "info", message: "Added opacity to the selected keyframe." } });
  }

  deleteOpacityProperty(): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        deleteKeyframeOpacity(keyframe);
      });
    }, { status: { tone: "info", message: "Deleted opacity from the selected keyframe." } });
  }

  deleteTransformProperty(): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        deleteKeyframeTransforms(keyframe);
      });
    }, { status: { tone: "info", message: "Deleted transforms from the selected keyframe." } });
  }

  clearTransformProperty(): void {
    this.stateController.commitEditorChange(() => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        clearKeyframeTransforms(keyframe);
      });
    }, { status: { tone: "info", message: "Cleared transforms to none for the selected keyframe." } });
  }
}
