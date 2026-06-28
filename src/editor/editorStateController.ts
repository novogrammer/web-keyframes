import { cloneDocument } from "../core/normalize.js";
import type { WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import { clampIndex, sanitizeEditorDocument } from "./editorModel.js";
import type { ActivePreview } from "./controller/EditorPreviewController.js";

export type StatusTone = "info" | "success" | "error";

export type FocusSnapshot = {
  field: string;
  index: number;
  selectionStart: number | null;
  selectionEnd: number | null;
};

export type PanelPosition = {
  left: number;
  top: number;
};

export type EditorState = {
  data: WebKeyframesDocument;
  selectedTimelineIndex: number;
  selectedKeyframeIndex: number;
  statusMessage: string;
  statusTone: StatusTone;
  previewTitle: string | null;
  previewContent: string;
  pendingFocus: FocusSnapshot | null;
  panelPosition: PanelPosition | null;
  activePreview: ActivePreview | null;
};

export function createEditorState(
  initialData: WebKeyframesDocument,
  defaultTimelineData: WebKeyframesTimeline,
): EditorState {
  return {
    data: cloneDocument(initialData),
    selectedTimelineIndex: 0,
    selectedKeyframeIndex: 0,
    statusMessage: "Timeline order is explicit. Preview and CSS use the selected timeline or the full document consistently.",
    statusTone: "info",
    previewTitle: null,
    previewContent: "",
    pendingFocus: null,
    panelPosition: null,
    activePreview: null,
  };
}

export function normalizeEditorState(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
): void {
  state.data = sanitizeEditorDocument(state.data, defaultTimelineData);
  state.selectedTimelineIndex = clampIndex(state.selectedTimelineIndex, state.data.timelines.length);
  state.selectedKeyframeIndex = clampIndex(state.selectedKeyframeIndex, getSelectedTimeline(state).keyframes.length);
}

export function getSelectedTimeline(state: EditorState): WebKeyframesTimeline {
  return state.data.timelines[state.selectedTimelineIndex] ?? state.data.timelines[0];
}

export function setStatus(state: EditorState, tone: StatusTone, message: string): void {
  state.statusTone = tone;
  state.statusMessage = message;
}

export function setPreviewPanel(state: EditorState, title: string, content: string): void {
  state.previewTitle = title;
  state.previewContent = content;
}

export function clearPreviewPanel(state: EditorState): void {
  state.previewTitle = null;
  state.previewContent = "";
}
