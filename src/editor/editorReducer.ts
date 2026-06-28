import {
  addTransform,
  moveTransform,
  removeTransform,
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/edit.js";
import {
  cloneTimeline,
  createDefaultTransform,
  createOpacityProperty,
  createTransformProperty,
  DEFAULT_TRANSLATE_CONFIG,
  deleteKeyframeProperty,
  getTimelinePositionType,
  hasKeyframeProperty,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type { TransformKind, TranslateUnit, WebKeyframe, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampIndex,
  clampNumber,
  cloneSparseKeyframe,
  createDuplicatedTimeline,
  createNextKeyframe,
  createNextTimeline,
  getEditorKeyframePosition,
  roundEditorPosition,
  sanitizeEditorDocument,
} from "./editorModel.js";
import {
  type EditorState,
  type FocusSnapshot,
  applyEditedTransforms,
  normalizeEditorState,
  setStatus,
  sortKeyframesByPosition,
  updateSelectedTimeline,
  updateSelectedTimelineKeyframes,
  withSelectedKeyframe,
} from "./editorStateController.js";

type TimelineOperation = "select" | "add" | "duplicate" | "delete";
type KeyframeOperation = "select" | "add" | "duplicate" | "delete";
type PropertyTarget = "timingFunction" | "opacity" | "transform";
type PropertyOperation = "set" | "clear" | "add" | "delete" | "move" | "changeKind" | "changeValue";

export type EditorAction =
  | { type: "reset"; initialData: WebKeyframesDocument }
  | { type: "timelineAction"; operation: TimelineOperation; index?: number }
  | { type: "keyframeAction"; operation: KeyframeOperation; index?: number }
  | {
      type: "propertyAction";
      target: PropertyTarget;
      operation: PropertyOperation;
      value?: string | number;
      kind?: TransformKind;
      index?: number;
      direction?: -1 | 1;
      field?: "x" | "y" | "value";
    }
  | { type: "applyField"; field: string; value: string | number; focusSnapshot?: FocusSnapshot | null };

export function dispatchEditorAction(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  action: EditorAction,
): boolean {
  switch (action.type) {
    case "reset":
      state.data = cloneDocument(action.initialData);
      state.selectedTimelineIndex = 0;
      state.selectedKeyframeIndex = 0;
      state.previewTitle = null;
      state.previewContent = "";
      state.pendingFocus = null;
      setStatus(state, "success", "Reset editor data to the initial state.");
      return true;
    case "timelineAction":
      return handleTimelineAction(state, defaultTimelineData, action);
    case "keyframeAction":
      return handleKeyframeAction(state, defaultTimelineData, action);
    case "propertyAction":
      return handlePropertyAction(state, defaultTimelineData, action);
    case "applyField":
      return handleFieldAction(state, defaultTimelineData, action.field, action.value, action.focusSnapshot ?? null);
  }
}

function handleTimelineAction(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  action: Extract<EditorAction, { type: "timelineAction" }>,
): boolean {
  switch (action.operation) {
    case "select":
      state.selectedTimelineIndex = clampIndex(action.index ?? 0, state.data.timelines.length);
      normalizeEditorState(state, defaultTimelineData);
      return true;
    case "add":
      addTimeline(state, defaultTimelineData);
      return true;
    case "duplicate":
      duplicateTimeline(state, defaultTimelineData);
      return true;
    case "delete":
      return deleteTimeline(state, defaultTimelineData);
  }
}

function handleKeyframeAction(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  action: Extract<EditorAction, { type: "keyframeAction" }>,
): boolean {
  switch (action.operation) {
    case "select":
      state.selectedKeyframeIndex = clampIndex(action.index ?? 0, getSelectedTimelineKeyframeLength(state));
      return true;
    case "add":
      addKeyframe(state, defaultTimelineData);
      return true;
    case "duplicate":
      duplicateKeyframe(state, defaultTimelineData);
      return true;
    case "delete":
      return deleteKeyframe(state, defaultTimelineData);
  }
}

function handlePropertyAction(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  action: Extract<EditorAction, { type: "propertyAction" }>,
): boolean {
  if (action.target === "timingFunction") {
    return editSelectedKeyframe(
      state,
      "Editing timeline data.",
      action.operation === "set"
        ? (_, keyframe) => {
            keyframe.timingFunction = String(action.value ?? "");
            state.pendingFocus = {
              field: "timingFunction",
              index: 0,
              selectionStart: String(action.value ?? "").length,
              selectionEnd: String(action.value ?? "").length,
            };
          }
        : (_, keyframe) => {
            delete keyframe.timingFunction;
            state.pendingFocus = {
              field: "timingFunction",
              index: 0,
              selectionStart: 0,
              selectionEnd: 0,
            };
          },
    );
  }

  if (action.target === "opacity") {
    if (action.operation === "add") {
      return editSelectedKeyframe(state, "Added opacity to the selected keyframe.", (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(1));
      });
    }

    return editSelectedKeyframe(state, "Deleted opacity from the selected keyframe.", (_, keyframe) => {
      deleteKeyframeProperty(keyframe, "opacity");
    });
  }

  switch (action.operation) {
    case "add":
      addSelectedTransform(state, defaultTimelineData, action.kind ?? "translate");
      return true;
    case "delete":
      if (typeof action.index === "number") {
        applyEditedTransforms(state, defaultTimelineData, (timeline) => removeTransform(
          timeline,
          state.selectedKeyframeIndex,
          action.index,
        ));
        setStatus(state, "info", "Removed transform.");
        return true;
      }
      return editSelectedKeyframe(state, "Deleted transforms from the selected keyframe.", (_, keyframe) => {
        deleteKeyframeProperty(keyframe, "transform");
      });
    case "clear":
      return editSelectedKeyframe(state, "Cleared transforms to none for the selected keyframe.", (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createTransformProperty([]));
      });
    case "move":
      applyEditedTransforms(state, defaultTimelineData, (timeline) => moveTransform(
        timeline,
        state.selectedKeyframeIndex,
        action.index ?? 0,
        action.direction ?? 1,
      ));
      setStatus(state, "info", "Reordered transforms.");
      return true;
    case "changeKind":
      applyEditedTransforms(state, defaultTimelineData, (timeline) =>
        replaceTransformKind(timeline, state.selectedKeyframeIndex, action.index ?? 0, action.kind ?? "translate")
      );
      setStatus(state, "info", "Editing timeline data.");
      return true;
    case "changeValue":
      applyEditedTransforms(state, defaultTimelineData, (timeline) =>
        setTransformFieldValue(timeline, state.selectedKeyframeIndex, action.index ?? 0, action.field ?? "x", Number(action.value ?? 0))
      );
      setStatus(state, "info", "Editing timeline data.");
      return true;
    default:
      return false;
  }
}

function handleFieldAction(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: string | number,
  focusSnapshot: FocusSnapshot | null,
): boolean {
  if (typeof value === "string") {
    switch (field) {
      case "animationName":
        if (value.trim() === "") {
          return commitFieldEditResult(state, focusSnapshot);
        }
        updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
          timeline.animationName = value.trim();
        });
        return commitFieldEditResult(state, focusSnapshot);
      case "positionType":
        updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
          const nextPositionType = value === "percent" ? "percent" : "time";
          if (nextPositionType === timeline.positionType) {
            return;
          }
          if (nextPositionType === "percent") {
            convertTimelineKeyframesToPercent(timeline, defaultTimelineData.duration ?? 1);
            return;
          }
          convertTimelineKeyframesToTime(timeline, defaultTimelineData.duration ?? 1200);
        });
        normalizeEditorState(state, defaultTimelineData);
        return commitFieldEditResult(state, focusSnapshot);
      case "translateUnit":
        updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
          timeline.translateConfig = {
            ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
            unit: value as TranslateUnit,
          };
        });
        return commitFieldEditResult(state, focusSnapshot);
      case "timingFunction":
        editSelectedKeyframe(state, "", (_, keyframe) => {
          if (value.trim() === "") {
            delete keyframe.timingFunction;
            return;
          }
          keyframe.timingFunction = value.trim();
        }, false);
        return commitFieldEditResult(state, focusSnapshot);
    }

    const kindMatch = /^transform-kind-(\d+)$/.exec(field);
    if (!kindMatch) {
      return false;
    }

    const changed = handlePropertyAction(state, defaultTimelineData, {
      type: "propertyAction",
      target: "transform",
      operation: "changeKind",
      index: Number(kindMatch[1]),
      kind: value as TransformKind,
    });
    if (changed && focusSnapshot) {
      state.pendingFocus = focusSnapshot;
    }
    return changed;
  }

  switch (field) {
    case "duration":
      updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
        if (timeline.positionType === "percent") {
          return;
        }
        timeline.duration = Math.max(1, Math.round(value));
        clampTimelineKeyframesToDuration(timeline);
      });
      normalizeEditorState(state, defaultTimelineData);
      return commitFieldEditResult(state, focusSnapshot);
    case "position":
      updateSelectedTimelineKeyframes(state, defaultTimelineData, (keyframes, timeline) => {
        const selected = keyframes[state.selectedKeyframeIndex];
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
        keyframes.splice(0, keyframes.length, ...keyframes.sort(
          (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
        ));
        state.selectedKeyframeIndex = keyframes.indexOf(selected);
      });
      return commitFieldEditResult(state, focusSnapshot);
    case "opacity":
      editSelectedKeyframe(state, "", (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
      }, false);
      return commitFieldEditResult(state, focusSnapshot);
  }

  const valueMatch = /^transform-(x|y|value)-(\d+)$/.exec(field);
  if (!valueMatch) {
    return false;
  }

  const changed = handlePropertyAction(state, defaultTimelineData, {
    type: "propertyAction",
    target: "transform",
    operation: "changeValue",
    field: valueMatch[1] as "x" | "y" | "value",
    index: Number(valueMatch[2]),
    value,
  });
  if (changed && focusSnapshot) {
    state.pendingFocus = focusSnapshot;
  }
  return changed;
}

function commitFieldEditResult(state: EditorState, focusSnapshot: FocusSnapshot | null): boolean {
  state.pendingFocus = focusSnapshot;
  setStatus(state, "info", "Editing timeline data.");
  return true;
}

function addTimeline(state: EditorState, defaultTimelineData: WebKeyframesTimeline): void {
  const nextTimeline = createNextTimeline(state.data.timelines, state.selectedTimelineIndex, defaultTimelineData);
  state.data = sanitizeEditorDocument({ timelines: [...state.data.timelines, nextTimeline] }, defaultTimelineData);
  state.selectedTimelineIndex = state.data.timelines.findIndex((timeline) => timeline.animationName === nextTimeline.animationName);
  state.selectedKeyframeIndex = 0;
  setStatus(state, "info", "Added timeline.");
}

function duplicateTimeline(state: EditorState, defaultTimelineData: WebKeyframesTimeline): void {
  const source = state.data.timelines[state.selectedTimelineIndex] ?? state.data.timelines[0];
  const duplicate = createDuplicatedTimeline(source, state.data.timelines);
  const timelines = state.data.timelines.map((timeline) => cloneTimeline(timeline));
  timelines.splice(state.selectedTimelineIndex + 1, 0, duplicate);
  state.data = sanitizeEditorDocument({ timelines }, defaultTimelineData);
  state.selectedTimelineIndex = state.selectedTimelineIndex + 1;
  normalizeEditorState(state, defaultTimelineData);
  setStatus(state, "info", "Duplicated timeline.");
}

function deleteTimeline(state: EditorState, defaultTimelineData: WebKeyframesTimeline): boolean {
  if (state.data.timelines.length <= 1) {
    return false;
  }
  state.data = sanitizeEditorDocument({
    timelines: state.data.timelines.filter((_, index) => index !== state.selectedTimelineIndex),
  }, defaultTimelineData);
  normalizeEditorState(state, defaultTimelineData);
  setStatus(state, "info", "Deleted timeline.");
  return true;
}

function addKeyframe(state: EditorState, defaultTimelineData: WebKeyframesTimeline): void {
  updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
    const positionType = getTimelinePositionType(timeline);
    const nextFrame = createNextKeyframe(timeline, timeline.keyframes, state.selectedKeyframeIndex);
    timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, nextFrame], positionType);
    state.selectedKeyframeIndex = timeline.keyframes.indexOf(nextFrame);
  });
}

function deleteKeyframe(state: EditorState, defaultTimelineData: WebKeyframesTimeline): boolean {
  const timeline = state.data.timelines[state.selectedTimelineIndex] ?? state.data.timelines[0];
  if (timeline.keyframes.length === 0) {
    return false;
  }
  updateSelectedTimeline(state, defaultTimelineData, (candidate) => {
    candidate.keyframes = candidate.keyframes.filter((_, index) => index !== state.selectedKeyframeIndex);
    state.selectedKeyframeIndex = clampIndex(state.selectedKeyframeIndex, candidate.keyframes.length);
  });
  return true;
}

function duplicateKeyframe(state: EditorState, defaultTimelineData: WebKeyframesTimeline): void {
  updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
    const positionType = getTimelinePositionType(timeline);
    const source = timeline.keyframes[state.selectedKeyframeIndex];
    if (!source) {
      return;
    }
    const duplicate = cloneSparseKeyframe(source);
    const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
    const offset = positionType === "time" ? Math.max(1, Math.round((timeline.duration ?? 1) * 0.1)) : 10;
    const nextPosition = Math.min(maxPosition, getEditorKeyframePosition(source, positionType) + offset);
    applyEditorKeyframePosition(
      duplicate,
      positionType,
      clampNumber(roundEditorPosition(nextPosition, positionType), 0, maxPosition),
    );
    timeline.keyframes = sortKeyframesByPosition([...timeline.keyframes, duplicate], positionType);
    state.selectedKeyframeIndex = timeline.keyframes.indexOf(duplicate);
  });
  setStatus(state, "info", "Duplicated selected keyframe.");
}

function addSelectedTransform(state: EditorState, defaultTimelineData: WebKeyframesTimeline, kind: TransformKind): void {
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
}

function editSelectedKeyframe(
  state: EditorState,
  statusMessage: string,
  update: (timeline: WebKeyframesTimeline, keyframe: WebKeyframe) => void,
  withStatus = true,
): boolean {
  let changed = false;
  withSelectedKeyframe(state, (timeline, keyframe) => {
    update(timeline, keyframe);
    changed = true;
  });
  if (changed && withStatus && statusMessage !== "") {
    setStatus(state, "info", statusMessage);
  }
  return changed;
}

function convertTimelineKeyframesToPercent(timeline: WebKeyframesTimeline, fallbackDuration: number): void {
  const duration = Math.max(timeline.duration ?? fallbackDuration, 1);
  timeline.positionType = "percent";
  delete timeline.duration;
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };
    const percent = typeof nextKeyframe.time === "number" ? (nextKeyframe.time / duration) * 100 : 0;
    applyEditorKeyframePosition(nextKeyframe, "percent", clampNumber(percent, 0, 100));
    return nextKeyframe;
  });
}

function convertTimelineKeyframesToTime(timeline: WebKeyframesTimeline, nextDuration: number): void {
  timeline.positionType = "time";
  timeline.duration = Math.max(1, Math.round(nextDuration));
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };
    const percent = typeof nextKeyframe.percent === "number" ? nextKeyframe.percent : 0;
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(Math.round((percent / 100) * (timeline.duration ?? 1)), 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}

function clampTimelineKeyframesToDuration(timeline: WebKeyframesTimeline): void {
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = { ...keyframe };
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(typeof nextKeyframe.time === "number" ? nextKeyframe.time : 0, 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}

function cloneDocument(document: WebKeyframesDocument): WebKeyframesDocument {
  return {
    timelines: document.timelines.map((timeline) => cloneTimeline(timeline)),
  };
}

function getSelectedTimelineKeyframeLength(state: EditorState): number {
  return state.data.timelines[state.selectedTimelineIndex]?.keyframes.length ?? 0;
}
