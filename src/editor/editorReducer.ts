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

export type EditorAction =
  | { type: "reset"; initialData: WebKeyframesDocument }
  | { type: "selectTimeline"; index: number }
  | { type: "addTimeline" | "duplicateTimeline" | "deleteTimeline" }
  | { type: "selectKeyframe"; index: number }
  | { type: "addKeyframe" | "deleteKeyframe" | "duplicateKeyframe" }
  | { type: "setTimingFunctionPreset"; value: string }
  | { type: "clearTimingFunction" }
  | { type: "moveTransform"; index: number; direction: -1 | 1 }
  | { type: "deleteTransform"; index: number }
  | { type: "addTransform"; kind: TransformKind }
  | { type: "addOpacity" | "deleteOpacity" | "deleteTransforms" | "clearTransforms" }
  | { type: "applyStringField"; field: string; value: string; focusSnapshot?: FocusSnapshot | null }
  | { type: "applyNumberField"; field: string; value: number; focusSnapshot?: FocusSnapshot | null };

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
    case "selectTimeline":
      state.selectedTimelineIndex = clampIndex(action.index, state.data.timelines.length);
      normalizeEditorState(state, defaultTimelineData);
      return true;
    case "addTimeline":
      addTimeline(state, defaultTimelineData);
      return true;
    case "duplicateTimeline":
      duplicateTimeline(state, defaultTimelineData);
      return true;
    case "deleteTimeline":
      return deleteTimeline(state, defaultTimelineData);
    case "selectKeyframe":
      state.selectedKeyframeIndex = clampIndex(action.index, getSelectedTimelineKeyframeLength(state));
      return true;
    case "addKeyframe":
      addKeyframe(state, defaultTimelineData);
      return true;
    case "deleteKeyframe":
      return deleteKeyframe(state, defaultTimelineData);
    case "duplicateKeyframe":
      duplicateKeyframe(state, defaultTimelineData);
      return true;
    case "setTimingFunctionPreset":
      return setTimingFunctionPreset(state, action.value);
    case "clearTimingFunction":
      return clearTimingFunction(state);
    case "moveTransform":
      moveSelectedTransform(state, defaultTimelineData, action.index, action.direction);
      return true;
    case "deleteTransform":
      deleteSelectedTransform(state, defaultTimelineData, action.index);
      return true;
    case "addTransform":
      addSelectedTransform(state, defaultTimelineData, action.kind);
      return true;
    case "addOpacity":
      return addOpacityProperty(state);
    case "deleteOpacity":
      return deleteOpacityProperty(state);
    case "deleteTransforms":
      return deleteTransformProperty(state);
    case "clearTransforms":
      return clearTransformProperty(state);
    case "applyStringField":
      return applyStringField(state, defaultTimelineData, action.field, action.value, action.focusSnapshot ?? null);
    case "applyNumberField":
      return applyNumberField(state, defaultTimelineData, action.field, action.value, action.focusSnapshot ?? null);
  }
}

function addTimeline(state: EditorState, defaultTimelineData: WebKeyframesTimeline): void {
  const nextTimeline = createNextTimeline(
    state.data.timelines,
    state.selectedTimelineIndex,
    defaultTimelineData,
  );
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

function setTimingFunctionPreset(state: EditorState, value: string): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    keyframe.timingFunction = value;
    changed = true;
  });
  if (!changed) {
    return false;
  }

  state.pendingFocus = {
    field: "timingFunction",
    index: 0,
    selectionStart: value.length,
    selectionEnd: value.length,
  };
  setStatus(state, "info", "Editing timeline data.");
  return true;
}

function clearTimingFunction(state: EditorState): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    delete keyframe.timingFunction;
    changed = true;
  });
  if (!changed) {
    return false;
  }

  state.pendingFocus = {
    field: "timingFunction",
    index: 0,
    selectionStart: 0,
    selectionEnd: 0,
  };
  setStatus(state, "info", "Editing timeline data.");
  return true;
}

function moveSelectedTransform(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  index: number,
  direction: -1 | 1,
): void {
  applyEditedTransforms(state, defaultTimelineData, (timeline) => moveTransform(
    timeline,
    state.selectedKeyframeIndex,
    index,
    direction,
  ));
  setStatus(state, "info", "Reordered transforms.");
}

function deleteSelectedTransform(state: EditorState, defaultTimelineData: WebKeyframesTimeline, index: number): void {
  applyEditedTransforms(state, defaultTimelineData, (timeline) => removeTransform(
    timeline,
    state.selectedKeyframeIndex,
    index,
  ));
  setStatus(state, "info", "Removed transform.");
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

function addOpacityProperty(state: EditorState): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    upsertKeyframeProperty(keyframe, createOpacityProperty(1));
    changed = true;
  });
  if (changed) {
    setStatus(state, "info", "Added opacity to the selected keyframe.");
  }
  return changed;
}

function deleteOpacityProperty(state: EditorState): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    deleteKeyframeProperty(keyframe, "opacity");
    changed = true;
  });
  if (changed) {
    setStatus(state, "info", "Deleted opacity from the selected keyframe.");
  }
  return changed;
}

function deleteTransformProperty(state: EditorState): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    deleteKeyframeProperty(keyframe, "transform");
    changed = true;
  });
  if (changed) {
    setStatus(state, "info", "Deleted transforms from the selected keyframe.");
  }
  return changed;
}

function clearTransformProperty(state: EditorState): boolean {
  let changed = false;
  withSelectedKeyframe(state, (_, keyframe) => {
    upsertKeyframeProperty(keyframe, createTransformProperty([]));
    changed = true;
  });
  if (changed) {
    setStatus(state, "info", "Cleared transforms to none for the selected keyframe.");
  }
  return changed;
}

function applyStringField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: string,
  focusSnapshot: FocusSnapshot | null,
): boolean {
  const handler = timelineStringHandlers[field] ?? keyframeStringHandlers[field];
  if (handler) {
    handler(state, defaultTimelineData, value);
    state.pendingFocus = focusSnapshot;
    setStatus(state, "info", "Editing timeline data.");
    return true;
  }

  return applyTransformStringField(state, defaultTimelineData, field, value, focusSnapshot);
}

function applyNumberField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: number,
  focusSnapshot: FocusSnapshot | null,
): boolean {
  const handler = timelineNumberHandlers[field] ?? keyframeNumberHandlers[field];
  if (handler) {
    handler(state, defaultTimelineData, value);
    state.pendingFocus = focusSnapshot;
    setStatus(state, "info", "Editing timeline data.");
    return true;
  }

  return applyTransformNumberField(state, defaultTimelineData, field, value, focusSnapshot);
}

const timelineStringHandlers: Record<string, (state: EditorState, defaultTimelineData: WebKeyframesTimeline, value: string) => void> = {
  animationName: (state, defaultTimelineData, value) => {
    if (value.trim() === "") {
      return;
    }
    updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
      timeline.animationName = value.trim();
    });
  },
  positionType: (state, defaultTimelineData, value) => {
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
  },
  translateUnit: (state, defaultTimelineData, value) => {
    updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
      timeline.translateConfig = {
        ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
        unit: value as TranslateUnit,
      };
    });
  },
};

const keyframeStringHandlers: Record<string, (state: EditorState, defaultTimelineData: WebKeyframesTimeline, value: string) => void> = {
  timingFunction: (state, _defaultTimelineData, value) => {
    withSelectedKeyframe(state, (_, keyframe) => {
      if (value.trim() === "") {
        delete keyframe.timingFunction;
        return;
      }
      keyframe.timingFunction = value.trim();
    });
  },
};

const timelineNumberHandlers: Record<string, (state: EditorState, defaultTimelineData: WebKeyframesTimeline, value: number) => void> = {
  duration: (state, defaultTimelineData, value) => {
    updateSelectedTimeline(state, defaultTimelineData, (timeline) => {
      if (timeline.positionType === "percent") {
        return;
      }

      timeline.duration = Math.max(1, Math.round(value));
      clampTimelineKeyframesToDuration(timeline);
    });
    normalizeEditorState(state, defaultTimelineData);
  },
};

const keyframeNumberHandlers: Record<string, (state: EditorState, defaultTimelineData: WebKeyframesTimeline, value: number) => void> = {
  position: (state, defaultTimelineData, value) => {
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
  },
  opacity: (state, _defaultTimelineData, value) => {
    withSelectedKeyframe(state, (_, keyframe) => {
      upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
    });
  },
};

function applyTransformStringField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: string,
  focusSnapshot: FocusSnapshot | null,
): boolean {
  if (!field.startsWith("transform-kind-")) {
    return false;
  }

  const index = Number(field.slice("transform-kind-".length));
  applyEditedTransforms(state, defaultTimelineData, (timeline) =>
    replaceTransformKind(timeline, state.selectedKeyframeIndex, index, value as TransformKind)
  );
  state.pendingFocus = focusSnapshot;
  setStatus(state, "info", "Editing timeline data.");
  return true;
}

function applyTransformNumberField(
  state: EditorState,
  defaultTimelineData: WebKeyframesTimeline,
  field: string,
  value: number,
  focusSnapshot: FocusSnapshot | null,
): boolean {
  const match = /^transform-(x|y|value)-(\d+)$/.exec(field);
  if (!match) {
    return false;
  }

  const transformField = match[1] as "x" | "y" | "value";
  const index = Number(match[2]);
  applyEditedTransforms(state, defaultTimelineData, (timeline) =>
    setTransformFieldValue(timeline, state.selectedKeyframeIndex, index, transformField, value)
  );
  state.pendingFocus = focusSnapshot;
  setStatus(state, "info", "Editing timeline data.");
  return true;
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
