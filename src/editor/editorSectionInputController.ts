import {
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/edit.js";
import { getTimelinePositionType } from "../core/normalize.js";
import type {
  TransformKind,
  TranslateUnit,
  WebKeyframesTimeline,
} from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampNumber,
  roundEditorPosition,
} from "./editorModel.js";
import { EditorInputController } from "./editorInputController.js";
import {
  applyKeyframeOpacity,
  applyKeyframeTimingFunction,
  applyTimelineDuration,
  applyTimelinePositionType,
  applyTimelineTranslateCustomUnit,
  applyTimelineTranslateUnit,
} from "./editorMutationHelpers.js";
import { EditorStateController } from "./editorStateController.js";

type StatusTone = "info" | "success" | "error";

type EditorSectionInputControllerOptions = {
  defaultTimelineData: WebKeyframesTimeline;
  getSelectedKeyframeIndex: () => number;
  setSelectedKeyframeIndex: (index: number) => void;
  inputController: EditorInputController;
  stateController: EditorStateController;
  setStatus: (tone: StatusTone, message: string) => void;
  render: () => void;
  renderWithStatus: (tone: StatusTone, message: string) => void;
};

export class EditorSectionInputController {
  private readonly defaultTimelineData: WebKeyframesTimeline;
  private readonly getSelectedKeyframeIndexState: () => number;
  private readonly setSelectedKeyframeIndexState: (index: number) => void;
  private readonly inputController: EditorInputController;
  private readonly stateController: EditorStateController;
  private readonly setStatusState: (tone: StatusTone, message: string) => void;
  private readonly renderState: () => void;
  private readonly renderWithStatusState: (tone: StatusTone, message: string) => void;

  constructor(options: EditorSectionInputControllerOptions) {
    this.defaultTimelineData = options.defaultTimelineData;
    this.getSelectedKeyframeIndexState = options.getSelectedKeyframeIndex;
    this.setSelectedKeyframeIndexState = options.setSelectedKeyframeIndex;
    this.inputController = options.inputController;
    this.stateController = options.stateController;
    this.setStatusState = options.setStatus;
    this.renderState = options.render;
    this.renderWithStatusState = options.renderWithStatus;
  }

  handleDurationInput(input: HTMLInputElement, eventType: "input" | "change"): void {
    if (input.type !== "number" || eventType !== "change") {
      return;
    }

    this.inputController.commitNumberInput("duration", input, (value) => {
      this.stateController.updateSelectedTimeline((timeline) => {
        applyTimelineDuration(timeline, value);
      });
    });
    this.renderWithStatusState("info", "Editing timeline data.");
  }

  handleKeyframePositionInput(input: HTMLInputElement, eventType: "input" | "change"): void {
    const updatePosition = (value: number) => {
      this.stateController.updateSelectedTimelineKeyframes((keyframes, timeline) => {
        const selected = keyframes[this.getSelectedKeyframeIndexState()];
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
        keyframes.splice(0, keyframes.length, ...this.stateController.sortKeyframesByPosition(keyframes, positionType));
        this.setSelectedKeyframeIndexState(keyframes.indexOf(selected));
      }, false);
    };

    this.inputController.handleBoundedNumberInput("position", input, eventType, updatePosition);
  }

  handleOpacityInput(input: HTMLInputElement, eventType: "input" | "change"): void {
    const updateOpacity = (value: number) => {
      this.stateController.commitEditorChange(() => {
        this.stateController.withSelectedKeyframe((_, keyframe) => {
          applyKeyframeOpacity(keyframe, value);
        });
      }, { render: false });
    };

    this.inputController.handleBoundedNumberInput("opacity", input, eventType, updateOpacity);
  }

  handlePositionTypeChange(select: HTMLSelectElement): void {
    this.inputController.capturePendingFocus("positionType", select);
    this.stateController.updateSelectedTimeline((timeline) => {
      applyTimelinePositionType(timeline, select.value === "percent" ? "percent" : "time", {
        fallbackPercentDuration: this.defaultTimelineData.duration ?? 1,
        fallbackTimeDuration: this.defaultTimelineData.duration ?? 1200,
      });
    });
    this.renderWithStatusState("info", "Editing timeline data.");
  }

  handleTimelineIdInput(input: HTMLInputElement): void {
    this.inputController.commitTextInput("id", input, () => {
      this.stateController.updateSelectedTimeline((timeline) => {
        timeline.id = input.value;
      });
    });
  }

  handleTimingFunctionInput(input: HTMLInputElement): void {
    this.inputController.commitTextInput("timingFunction", input, () => {
      this.stateController.withSelectedKeyframe((_, keyframe) => {
        applyKeyframeTimingFunction(keyframe, input.value);
      });
    });
  }

  applyTransformKindChange(index: number, value: string): void {
    this.stateController.applyEditedTransforms((timeline) =>
      replaceTransformKind(timeline, this.getSelectedKeyframeIndexState(), index, value as TransformKind)
    );
    this.setStatusState("info", "Editing timeline data.");
    this.renderState();
  }

  handleTranslateCustomUnitInput(input: HTMLInputElement): void {
    this.inputController.commitTextInput("translateCustomUnit", input, () => {
      this.stateController.updateSelectedTimeline((timeline) => {
        applyTimelineTranslateCustomUnit(timeline, input.value);
      });
    });
  }

  handleTranslateUnitChange(select: HTMLSelectElement): void {
    this.inputController.commitTextInput("translateUnit", select, () => {
      this.stateController.updateSelectedTimeline((timeline) => {
        applyTimelineTranslateUnit(timeline, select.value as TranslateUnit);
      });
    });
  }

  handleTransformValueInput(
    index: number,
    axis: "x" | "y" | "value",
    input: HTMLInputElement,
    eventType: "input" | "change",
  ): void {
    const field = `transform-${axis}-${index}`;
    const updateTransformValue = (value: number) => {
      this.stateController.applyEditedTransforms((timeline) =>
        setTransformFieldValue(timeline, this.getSelectedKeyframeIndexState(), index, axis, value)
      );
    };

    this.inputController.handleBoundedNumberInput(field, input, eventType, updateTransformValue);
  }
}
