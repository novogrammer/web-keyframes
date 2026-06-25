import { cloneDocument, cloneTimeline } from "../core/normalize.js";
import type { WebKeyframe, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import {
  clampIndex,
  sanitizeEditorDocument,
  cloneSparseKeyframe,
  getEditorKeyframePosition,
} from "./editorModel.js";
import type { ActivePreview } from "./EditorPreviewController.js";

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

export function resetEditorState(
  state: EditorState,
  initialData: WebKeyframesDocument,
): void {
  state.data = cloneDocument(initialData);
  state.selectedTimelineIndex = 0;
  state.selectedKeyframeIndex = 0;
  clearPreviewPanel(state);
}

export function updateSelectedTimeline(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  update: (timeline: WebKeyframesTimeline) => void,
): void {
  const timeline = getSelectedTimeline(state);
  update(timeline);
  normalizeEditorState(state, defaultTimelineData);
}

export function updateSelectedTimelineKeyframes(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  update: (keyframes: WebKeyframe[], timeline: WebKeyframesTimeline) => void,
): void {
  const timeline = getSelectedTimeline(state);
  const keyframes = timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));

  update(keyframes, timeline);
  timeline.keyframes = keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));
  normalizeEditorState(state, defaultTimelineData);
}

export function withSelectedKeyframe(
  state: EditorState,
  run: (timeline: WebKeyframesTimeline, keyframe: WebKeyframe) => void,
): void {
  const timeline = getSelectedTimeline(state);
  const keyframe = timeline.keyframes[state.selectedKeyframeIndex];
  if (!keyframe) {
    return;
  }

  run(timeline, keyframe);
}

export function applyEditedTransforms(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  edit: (timeline: WebKeyframesTimeline) => WebKeyframesTimeline,
): void {
  updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
    timeline.keyframes = cloneTimeline(edit(timeline)).keyframes;
  });
}

export function sortKeyframesByPosition(
  keyframes: WebKeyframe[],
  positionType: "time" | "percent",
): WebKeyframe[] {
  return [...keyframes].sort(
    (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
  );
}
