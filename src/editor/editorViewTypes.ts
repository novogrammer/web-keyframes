import { deriveEditorRenderState } from "./editorModel.js";

export type EditorRenderState = ReturnType<typeof deriveEditorRenderState>;

export type EditorViewState = {
  previewContent: string;
  previewTitle: string | null;
  selectedKeyframeIndex: number;
  selectedTimelineIndex: number;
  statusMessage: string;
  statusTone: "info" | "success" | "error";
};

export type EditorViewHandlers = {
  onAction: (action: string, payload?: { index?: number; kind?: string; value?: string }) => void;
  onDurationInput: (input: HTMLInputElement, eventType: "input" | "change") => void;
  onKeyframePositionInput: (input: HTMLInputElement, eventType: "input" | "change") => void;
  onOpacityInput: (input: HTMLInputElement, eventType: "input" | "change") => void;
  onPositionTypeChange: (select: HTMLSelectElement) => void;
  onTimelineIdInput: (input: HTMLInputElement) => void;
  onTimingFunctionInput: (input: HTMLInputElement) => void;
  onTransformKindChange: (index: number, select: HTMLSelectElement) => void;
  onTransformValueInput: (
    index: number,
    axis: "x" | "y" | "value",
    input: HTMLInputElement,
    eventType: "input" | "change",
  ) => void;
  onTranslateCustomUnitInput: (input: HTMLInputElement) => void;
  onTranslateUnitChange: (select: HTMLSelectElement) => void;
};

export type EditorFieldElement = HTMLInputElement | HTMLSelectElement;
export type EditorFieldRegistry = Map<string, EditorFieldElement[]>;
export type RenderedEditorPanel = {
  panel: HTMLElement;
  fieldRegistry: EditorFieldRegistry;
};
