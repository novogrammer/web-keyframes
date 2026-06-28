import { formatNumber } from "../core/generateCss.js";
import {
  cloneDocument,
  cloneProperties,
  cloneTimeline,
  createDefaultTransform,
  createOpacityProperty,
  createTransformProperty,
  DEFAULT_TRANSLATE_CONFIG,
  deleteKeyframeProperty,
  getOpacityValue,
  getTransformOperations,
  hasKeyframeProperty,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type {
  KeyframePositionMode,
  NormalizedWebKeyframesTimeline,
  TransformKind,
  TransformOperation,
  TranslateUnit,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/types.js";
import { addTransform, moveTransform, removeTransform, replaceTransformKind, setTransformFieldValue } from "../core/edit.js";

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

export type ActivePreview = {
  styleElement: HTMLStyleElement;
  targets: Array<{ element: HTMLElement; inlineAnimationName: string }>;
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

type CollectionTarget = "timeline" | "keyframe";
type CollectionOperation = "select" | "add" | "duplicate" | "delete";
type FieldOperation = "set" | "clear" | "add" | "delete";
type TransformValueField = "x" | "y" | "value";
type TransformOperationKind = "add" | "delete" | "clear" | "move" | "changeKind" | "changeValue";

type ResetEditorAction = { type: "reset"; initialData: WebKeyframesDocument };
type TimelineCollectionAction = { type: "collectionAction"; target: "timeline"; operation: CollectionOperation; index?: number };
type KeyframeCollectionAction = { type: "collectionAction"; target: "keyframe"; operation: CollectionOperation; index?: number };
type CollectionEditorAction = TimelineCollectionAction | KeyframeCollectionAction;
type FieldEditorAction = { type: "fieldAction"; field: string; operation?: FieldOperation; value?: string | number; focusSnapshot?: FocusSnapshot | null };
type TransformEditorAction = {
  type: "transformAction";
  operation: TransformOperationKind;
  index?: number;
  kind?: TransformKind;
  direction?: -1 | 1;
  field?: TransformValueField;
  value?: number;
};

export type EditorAction =
  | ResetEditorAction
  | CollectionEditorAction
  | FieldEditorAction
  | TransformEditorAction;

type RenderTimeline = {
  animationName: string;
  positionType: KeyframePositionMode;
  duration: number | null;
  translateUnit: TranslateUnit;
  keyframes: WebKeyframe[];
};

type EditorView = {
  timelines: RenderTimeline[];
  selectedTimeline: RenderTimeline;
  sourceTimeline: WebKeyframesTimeline;
  selectedKeyframe: WebKeyframe | undefined;
  sourceKeyframe: WebKeyframe | undefined;
  hasKeyframe: boolean;
  opacityState: "explicit" | "unset";
  opacityValue: number | null;
  transforms: TransformOperation[];
  transformState: "unset" | "none" | "explicit";
  timingFunction: string;
};

const TIMING_FUNCTION_PRESETS = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end",
  "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "steps(4, end)",
] as const;

const TRANSFORM_BUTTONS = [
  ["translate", "+ Translate"],
  ["scale", "+ Scale"],
  ["rotate", "+ Rotate"],
  ["skew", "+ Skew"],
] as const satisfies ReadonlyArray<readonly [TransformKind, string]>;

const TRANSLATE_OPTIONS = ["px", "vw", "vh", "vmin", "vmax", "%", "em", "rem"] as const satisfies ReadonlyArray<TranslateUnit>;

export function createEditorState(initialData: WebKeyframesDocument): EditorState {
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

export function normalizeEditorState(state: EditorState): void {
  state.selectedTimelineIndex = clampIndex(state.selectedTimelineIndex, state.data.timelines.length);
  state.selectedKeyframeIndex = clampIndex(state.selectedKeyframeIndex, getSelectedTimeline(state).keyframes.length);
}

export function getSelectedTimeline(state: EditorState): WebKeyframesTimeline {
  return state.data.timelines[state.selectedTimelineIndex] ?? state.data.timelines[0];
}

export function renderEditorPanel(state: EditorState): string {
  normalizeEditorState(state);
  const view = deriveView(state.data, state.selectedTimelineIndex, state.selectedKeyframeIndex);
  state.selectedTimelineIndex = view.timelines.indexOf(view.selectedTimeline);
  state.selectedKeyframeIndex = view.selectedKeyframe ? view.selectedTimeline.keyframes.indexOf(view.selectedKeyframe) : 0;
  return `
    <div class="wkf__panel">
      <div class="wkf__header" data-wkf-drag-handle="true">
        <div>
          <p class="wkf__kicker">web-keyframes editor</p>
          <h2 class="wkf__title">Keyframe Data Editor</h2>
        </div>
        <div class="wkf__actions" data-wkf-no-drag="true">
          <button type="button" class="wkf__button wkf__button--ghost" data-wkf-action="reset">Reset</button>
          <button type="button" class="wkf__button wkf__button--ghost" data-wkf-action="hide">Hide</button>
        </div>
      </div>
      <div class="wkf__layout">
        <div class="wkf__columns">
          ${renderTimelineList(view, state.selectedTimelineIndex)}
          <div class="wkf__section">
            ${renderSelectedTimeline(view.selectedTimeline)}
            <div class="wkf__columns wkf__columns--stacked">
              ${renderKeyframeList(view, state.selectedKeyframeIndex)}
              ${renderSelectedKeyframe(view)}
            </div>
          </div>
        </div>
      </div>
      ${renderPreview(state.previewTitle, state.previewContent)}
      <div class="wkf__footer" data-wkf-drag-handle="true">
        <p class="wkf__note wkf__note--${state.statusTone}" data-wkf-status>${escapeHtml(state.statusMessage)}</p>
        <div class="wkf__inline-actions">
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="run-preview">Preview</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="reset-preview">Reset Preview</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-json">View JSON</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-css">View CSS</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="copy-json">Copy JSON</button>
          <button type="button" class="wkf__button wkf__button--small" data-wkf-action="copy-css">Copy CSS</button>
        </div>
      </div>
    </div>
  `;
}

export function dispatchEditorAction(state: EditorState, defaults: WebKeyframesTimeline, action: EditorAction): boolean {
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
    case "collectionAction":
      return action.target === "timeline" ? dispatchTimelineAction(state, defaults, action) : dispatchKeyframeAction(state, defaults, action);
    case "fieldAction":
      return dispatchFieldAction(state, defaults, action);
    case "transformAction":
      return dispatchTransformAction(state, defaults, action);
  }
  return false;
}

function dispatchTimelineAction(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  action: TimelineCollectionAction,
): boolean {
  switch (action.operation) {
    case "select":
      state.selectedTimelineIndex = clampIndex(action.index ?? 0, state.data.timelines.length);
      normalizeEditorState(state);
      return true;
    case "add": {
      const next = createNextTimeline(state.data.timelines, state.selectedTimelineIndex, defaults);
      state.data = { timelines: [...state.data.timelines.map((timeline) => cloneTimeline(timeline)), next] };
      state.selectedTimelineIndex = state.data.timelines.findIndex((timeline) => timeline.animationName === next.animationName);
      state.selectedKeyframeIndex = 0;
      setStatus(state, "info", "Added timeline.");
      return true;
    }
    case "duplicate": {
      const source = getSelectedTimeline(state);
      const duplicate = cloneTimeline(source);
      duplicate.animationName = uniqueAnimationName(`${source.animationName}-copy`, state.data.timelines);
      const timelines = state.data.timelines.map((timeline) => cloneTimeline(timeline));
      timelines.splice(state.selectedTimelineIndex + 1, 0, duplicate);
      state.data = { timelines };
      state.selectedTimelineIndex += 1;
      normalizeEditorState(state);
      setStatus(state, "info", "Duplicated timeline.");
      return true;
    }
    case "delete":
      if (state.data.timelines.length <= 1) {
        return false;
      }
      state.data = {
        timelines: state.data.timelines
          .filter((_, index) => index !== state.selectedTimelineIndex)
          .map((timeline) => cloneTimeline(timeline)),
      };
      normalizeEditorState(state);
      setStatus(state, "info", "Deleted timeline.");
      return true;
  }
  return false;
}

function dispatchKeyframeAction(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  action: KeyframeCollectionAction,
): boolean {
  switch (action.operation) {
    case "select":
      state.selectedKeyframeIndex = clampIndex(action.index ?? 0, getSelectedTimeline(state).keyframes.length);
      return true;
    case "add":
      editTimeline(state, defaults, (timeline) => {
        const next = createNextKeyframe(timeline, state.selectedKeyframeIndex);
        const positionType = timeline.positionType;
        timeline.keyframes = sortKeyframes([...timeline.keyframes, next], positionType);
        state.selectedKeyframeIndex = timeline.keyframes.indexOf(next);
      });
      return true;
    case "duplicate":
      editTimeline(state, defaults, (timeline) => {
        const source = timeline.keyframes[state.selectedKeyframeIndex];
        if (!source) {
          return;
        }
        const positionType = timeline.positionType;
        const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
        const offset = positionType === "time" ? Math.max(1, Math.round((timeline.duration ?? 1) * 0.1)) : 10;
        const duplicate = cloneSparseKeyframe(source);
        applyPosition(
          duplicate,
          positionType,
          clampNumber(roundPosition(getPosition(source, positionType) + offset, positionType), 0, maxPosition),
        );
        timeline.keyframes = sortKeyframes([...timeline.keyframes, duplicate], positionType);
        state.selectedKeyframeIndex = timeline.keyframes.indexOf(duplicate);
      });
      setStatus(state, "info", "Duplicated selected keyframe.");
      return true;
    case "delete": {
      const timeline = getSelectedTimeline(state);
      if (timeline.keyframes.length === 0) {
        return false;
      }
      editTimeline(state, defaults, (next) => {
        next.keyframes = next.keyframes.filter((_, index) => index !== state.selectedKeyframeIndex);
        state.selectedKeyframeIndex = clampIndex(state.selectedKeyframeIndex, next.keyframes.length);
      });
      return true;
    }
  }
  return false;
}

function dispatchFieldAction(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  action: FieldEditorAction,
): boolean {
  const operation = action.operation ?? "set";
  const focusSnapshot = action.focusSnapshot ?? null;
  if (typeof action.value === "string") {
    const stringValue = action.value;
    if (action.field === "timingFunction") {
      if (operation === "clear") {
        return editSelectedKeyframe(state, "Editing timeline data.", (_, keyframe) => {
          delete keyframe.timingFunction;
          state.pendingFocus = { field: "timingFunction", index: 0, selectionStart: 0, selectionEnd: 0 };
        });
      }
      editSelectedKeyframe(state, "", (_, keyframe) => {
        const value = stringValue.trim();
        if (value === "") {
          delete keyframe.timingFunction;
        } else {
          keyframe.timingFunction = value;
        }
      }, false);
      return commitField(state, focusSnapshot);
    }
    if (stringValue.trim() === "" && action.field === "animationName") {
      return commitField(state, focusSnapshot);
    }
    const handlers: Record<string, () => void> = {
      animationName: () => {
        editTimeline(state, defaults, (timeline) => {
          timeline.animationName = stringValue.trim();
        });
      },
      positionType: () => {
        editTimeline(state, defaults, (timeline) => {
          const nextType = stringValue === "percent" ? "percent" : "time";
          if (nextType === timeline.positionType) {
            return;
          }
          if (nextType === "percent") {
            convertKeyframesToPercent(timeline, defaults.duration ?? 1);
          } else {
            convertKeyframesToTime(timeline, defaults.duration ?? 1200);
          }
        });
      },
      translateUnit: () => {
        editTimeline(state, defaults, (timeline) => {
          timeline.translateConfig = { ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }), unit: stringValue as TranslateUnit };
        });
      },
    };
    const handler = handlers[action.field];
    if (handler) {
      handler();
      return commitField(state, focusSnapshot);
    }
    const transformField = parseTransformField(action.field);
    return transformField?.type === "kind"
      ? commitTransformField(state, defaults, focusSnapshot, {
          type: "transformAction",
          operation: "changeKind",
          index: transformField.index,
          kind: stringValue as TransformKind,
        })
      : false;
  }

  if (typeof action.value !== "number") {
    return false;
  }
  const numericValue = action.value;
  if (action.field === "opacity" && operation !== "set") {
    return operation === "add"
      ? editSelectedKeyframe(state, "Added opacity to the selected keyframe.", (_, keyframe) => {
          upsertKeyframeProperty(keyframe, createOpacityProperty(1));
        })
      : editSelectedKeyframe(state, "Deleted opacity from the selected keyframe.", (_, keyframe) => {
          deleteKeyframeProperty(keyframe, "opacity");
        });
  }
  const handlers: Record<string, () => void> = {
    duration: () => {
      editTimeline(state, defaults, (timeline) => {
        if (timeline.positionType === "percent") {
          return;
        }
        timeline.duration = Math.max(1, Math.round(numericValue));
        timeline.keyframes = timeline.keyframes.map((keyframe) => {
          const next = { ...keyframe };
          applyPosition(next, "time", clampNumber(getPosition(next, "time"), 0, timeline.duration ?? 1));
          return next;
        });
      });
    },
    position: () => {
      editTimeline(state, defaults, (timeline) => {
        const selected = timeline.keyframes[state.selectedKeyframeIndex];
        if (!selected) {
          return;
        }
        const type = timeline.positionType;
        const max = type === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
        applyPosition(selected, type, clampNumber(roundPosition(numericValue, type), 0, max));
        timeline.keyframes = sortKeyframes(timeline.keyframes, type);
        state.selectedKeyframeIndex = timeline.keyframes.indexOf(selected);
      });
    },
    opacity: () => {
      editSelectedKeyframe(state, "", (_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(numericValue, 0, 1)));
      }, false);
    },
  };
  const handler = handlers[action.field];
  if (handler) {
    handler();
    return commitField(state, focusSnapshot);
  }
  const transformField = parseTransformField(action.field);
  return transformField?.type === "value"
    ? commitTransformField(state, defaults, focusSnapshot, {
        type: "transformAction",
        operation: "changeValue",
        index: transformField.index,
        field: transformField.field,
        value: numericValue,
      })
    : false;
}

function dispatchTransformAction(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  action: TransformEditorAction,
): boolean {
  switch (action.operation) {
    case "add": {
      let added = false;
      editSelectedKeyframe(state, "", (_, keyframe) => {
        if (hasKeyframeProperty(keyframe, "transform")) {
          return;
        }
        upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(action.kind ?? "translate")]));
        added = true;
      }, false);
      if (!added) {
        editTimeline(state, defaults, (timeline) => {
          timeline.keyframes = cloneTimeline(addTransform(timeline, state.selectedKeyframeIndex, action.kind ?? "translate")).keyframes;
        });
      }
      setStatus(state, "info", `Added ${action.kind ?? "translate"} transform.`);
      return true;
    }
    case "delete":
      if (typeof action.index === "number") {
        editTimeline(state, defaults, (timeline) => {
          timeline.keyframes = cloneTimeline(removeTransform(timeline, state.selectedKeyframeIndex, action.index!)).keyframes;
        });
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
      return mutateTransforms(state, defaults, "Reordered transforms.", (timeline) =>
        moveTransform(timeline, state.selectedKeyframeIndex, action.index ?? 0, action.direction ?? 1));
    case "changeKind":
      return mutateTransforms(state, defaults, "Editing timeline data.", (timeline) =>
        replaceTransformKind(timeline, state.selectedKeyframeIndex, action.index ?? 0, action.kind ?? "translate"));
    case "changeValue":
      return mutateTransforms(state, defaults, "Editing timeline data.", (timeline) =>
        setTransformFieldValue(timeline, state.selectedKeyframeIndex, action.index ?? 0, action.field ?? "x", action.value ?? 0));
  }
  return false;
}

function deriveView(data: WebKeyframesDocument, timelineIndex: number, keyframeIndex: number): EditorView {
  const timelines = data.timelines.map((timeline) => ({
    animationName: timeline.animationName,
    positionType: timeline.positionType,
    duration: timeline.positionType === "time" && Number.isFinite(timeline.duration) && (timeline.duration ?? 0) > 0
      ? Math.round(timeline.duration ?? 1)
      : null,
    translateUnit: timeline.translateConfig?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
    keyframes: timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe)),
  }));
  const selectedTimeline = timelines[timelineIndex] ?? timelines[0];
  const selectedTimelineIndex = timelines.indexOf(selectedTimeline);
  const sourceTimeline = data.timelines[selectedTimelineIndex] ?? data.timelines[0]!;
  const selectedKeyframe = selectedTimeline.keyframes[keyframeIndex] ?? selectedTimeline.keyframes[0];
  const nextKeyframeIndex = selectedKeyframe ? selectedTimeline.keyframes.indexOf(selectedKeyframe) : 0;
  const sourceKeyframe = sourceTimeline.keyframes[nextKeyframeIndex] ?? sourceTimeline.keyframes[0];
  const hasKeyframe = !!selectedKeyframe && !!sourceKeyframe;
  const opacityState = hasKeyframe && hasKeyframeProperty(sourceKeyframe!, "opacity") ? "explicit" : "unset";
  const opacityValue = hasKeyframe ? getOpacityValue(sourceKeyframe!) : null;
  const transforms = hasKeyframe && hasKeyframeProperty(sourceKeyframe!, "transform") ? getTransformOperations(sourceKeyframe!) : [];
  const transformState = !hasKeyframe || !hasKeyframeProperty(sourceKeyframe!, "transform") ? "unset" : transforms.length === 0 ? "none" : "explicit";
  return {
    timelines,
    selectedTimeline,
    sourceTimeline,
    selectedKeyframe,
    sourceKeyframe,
    hasKeyframe,
    opacityState,
    opacityValue,
    transforms,
    transformState,
    timingFunction: hasKeyframe && typeof sourceKeyframe?.timingFunction === "string" ? sourceKeyframe.timingFunction.trim() : "",
  };
}

function renderTimelineList(view: EditorView, selectedTimelineIndex: number): string {
  return `
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Timelines</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <button type="button" class="wkf__button wkf__button--small" data-wkf-action="add-timeline">Add</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-timeline">Duplicate</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-timeline" ${view.timelines.length <= 1 ? "disabled" : ""}>Delete</button>
        </div>
      </div>
      <div class="wkf__keyframe-list">
        ${view.timelines.map((timeline, index) => renderSelectableItem(
          "select-timeline",
          index,
          index === selectedTimelineIndex,
          `
            <span class="wkf__keyframe-time">${escapeHtml(timeline.animationName)}</span>
            <span class="wkf__keyframe-percent">${escapeHtml(timeline.positionType === "time" ? `${String(timeline.duration ?? 1)}ms` : "percent mode")}</span>
            <span class="wkf__keyframe-meta">${escapeHtml(`${timeline.keyframes.length} keyframes`)}</span>
          `,
        )).join("")}
      </div>
    </div>
  `;
}

function renderSelectedTimeline(timeline: RenderTimeline): string {
  return `
    <div class="wkf__section">
      <div class="wkf__section-title">Selected Timeline</div>
      <div class="wkf__grid wkf__grid--meta">
        ${textField("animationName", "Animation Name", timeline.animationName)}
        ${selectField("positionType", "Keyframe Position", timeline.positionType, [["time", "time"], ["percent", "percent"]])}
        ${timeline.positionType === "time" ? numberField("duration", "Duration", timeline.duration ?? 1, 1, 1) : ""}
        ${selectField("translateUnit", "Translate Unit", timeline.translateUnit, TRANSLATE_OPTIONS.map((value) => [value, value]))}
      </div>
    </div>
  `;
}

function renderKeyframeList(view: EditorView, selectedKeyframeIndex: number): string {
  return `
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Keyframes</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <button type="button" class="wkf__button wkf__button--small" data-wkf-action="add-keyframe">Add</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-keyframe" ${view.selectedTimeline.keyframes.length === 0 ? "disabled" : ""}>Duplicate</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-keyframe" ${view.selectedTimeline.keyframes.length === 0 ? "disabled" : ""}>Delete</button>
        </div>
      </div>
      <div class="wkf__keyframe-list">
        ${
          view.selectedTimeline.keyframes.length
            ? view.selectedTimeline.keyframes.map((keyframe, index) => renderSelectableItem(
              "select-keyframe",
              index,
              index === selectedKeyframeIndex,
              `
                <span class="wkf__keyframe-time">${escapeHtml(keyframeLabel(keyframe, view.selectedTimeline))}</span>
                <span class="wkf__keyframe-percent">${escapeHtml(keyframeSecondaryLabel(keyframe, view.selectedTimeline))}</span>
                <span class="wkf__keyframe-meta">${escapeHtml(keyframeSummary(view.sourceTimeline.keyframes[index] ?? keyframe, view.selectedTimeline.translateUnit))}</span>
              `,
            )).join("")
            : `<div class="wkf__keyframe-item"><span class="wkf__keyframe-meta">No keyframes yet.</span></div>`
        }
      </div>
    </div>
  `;
}

function renderSelectedKeyframe(view: EditorView): string {
  const keyframe = view.selectedKeyframe ?? view.selectedTimeline.keyframes[0];
  return `
    <div class="wkf__section wkf__section--editor">
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Selected Keyframe</div>
          <p class="wkf__subtitle">${
            view.hasKeyframe
              ? escapeHtml(view.selectedTimeline.positionType === "time"
                ? `${keyframeSecondaryLabel(keyframe, view.selectedTimeline)} of timeline`
                : `${formatNumber(keyframe.percent ?? 0)}% of timeline`)
              : "Add a keyframe to start editing."
          }</p>
        </div>
      </div>
      ${
        view.hasKeyframe
          ? `
            <div class="wkf__grid wkf__grid--editor">
              ${positionField(view.selectedTimeline, keyframe)}
              ${textField("timingFunction", "Timing Function", view.timingFunction)}
              <div class="wkf__field wkf__field--full">
                <span class="wkf__label">Insert Preset</span>
                <div class="wkf__inline-actions wkf__inline-actions--wrap">
                  ${TIMING_FUNCTION_PRESETS.map((value) =>
                    `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="set-timing-function" data-wkf-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`
                  ).join("")}
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="clear-timing-function">Clear</button>
                </div>
              </div>
            </div>
            <div class="wkf__section-head wkf__section-head--properties"><div class="wkf__section-title">Properties</div></div>
            ${renderPropertyAddActions(view.opacityState, view.transformState)}
            <div class="wkf__property-list">
              ${renderOpacity(view.opacityState, view.opacityValue)}
              ${renderTransforms(view.transformState, view.transforms)}
            </div>
          `
          : `
            <div class="wkf__property">
              <p class="wkf__subtitle">This timeline has no keyframes yet.</p>
              <p class="wkf__subtitle">Use the Add button above to create the first keyframe.</p>
            </div>
          `
      }
    </div>
  `;
}

function renderPreview(title: string | null, content: string): string {
  if (title === null) {
    return "";
  }
  return `
    <div class="wkf__preview">
      <div class="wkf__preview-head">
        <div>
          <div class="wkf__section-title">${escapeHtml(title)}</div>
          <p class="wkf__subtitle">Current generated output</p>
        </div>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview">Close</button>
      </div>
      <textarea class="wkf__preview-textarea" readonly>${escapeHtml(content)}</textarea>
    </div>
  `;
}

function renderPropertyAddActions(opacityState: EditorView["opacityState"], transformState: EditorView["transformState"]): string {
  return opacityState !== "unset" && transformState !== "unset"
    ? ""
    : `
      <div class="wkf__property-add">
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          ${opacityState === "unset" ? `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-opacity">+ Opacity</button>` : ""}
          ${transformState === "unset" ? `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform">+ Transform</button>` : ""}
        </div>
      </div>
    `;
}

function renderOpacity(state: EditorView["opacityState"], value: number | null): string {
  if (state !== "explicit") {
    return "";
  }
  return `
    <div class="wkf__property">
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Opacity</div>
          <p class="wkf__subtitle">Set to ${escapeHtml(formatNumber(value ?? 1))}</p>
        </div>
        <div class="wkf__inline-actions">
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-opacity">Delete</button>
        </div>
      </div>
      ${rangeNumberField("opacity", "Opacity", value ?? 1, 0, 1, 0.01, "wkf__field wkf__field--full")}
    </div>
  `;
}

function renderTransforms(state: EditorView["transformState"], transforms: TransformOperation[]): string {
  if (state === "unset") {
    return "";
  }
  return `
    <div class="wkf__property">
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        ${TRANSFORM_BUTTONS.map(([kind, label]) =>
          `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="${kind}">${label}</button>`
        ).join("")}
      </div>
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Transforms</div>
          <p class="wkf__subtitle">${state === "none" ? "None" : `${transforms.length} item${transforms.length === 1 ? "" : "s"}`}</p>
        </div>
        <div class="wkf__inline-actions">
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-transforms">Delete</button>
          ${state === "explicit" ? `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="clear-transforms">None</button>` : ""}
        </div>
      </div>
      <div class="wkf__transform-list">${transforms.map((transform, index) => renderTransformEditor(transform, index, transforms.length)).join("")}</div>
    </div>
  `;
}

function renderTransformEditor(transform: TransformOperation, index: number, total: number): string {
  return `
    <div class="wkf__field">
      <div class="wkf__section-head">
        <div class="wkf__inline-actions">
          ${selectField(`transform-kind-${index}`, `Transform ${index + 1}`, transform.kind, [["translate", "translate"], ["scale", "scale"], ["rotate", "rotate"], ["skew", "skew"]])}
        </div>
        <div class="wkf__inline-actions">
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="move-transform-up" data-wkf-index="${index}" ${index === 0 ? "disabled" : ""}>Up</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="move-transform-down" data-wkf-index="${index}" ${index === total - 1 ? "disabled" : ""}>Down</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-transform" data-wkf-index="${index}">Delete</button>
        </div>
      </div>
      <div class="wkf__grid wkf__grid--editor">
        ${transform.kind === "translate" || transform.kind === "scale" || transform.kind === "skew"
          ? `${numberField(`transform-x-${index}`, "X", transform.x)}${numberField(`transform-y-${index}`, "Y", transform.y)}`
          : numberField(`transform-value-${index}`, "Value", transform.value)}
      </div>
    </div>
  `;
}

function textField(field: string, label: string, value: string): string {
  return `<label class="wkf__field"><span class="wkf__label">${escapeHtml(label)}</span><input class="wkf__input" type="text" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(value)}"></label>`;
}

function selectField(field: string, label: string, value: string, options: ReadonlyArray<readonly [string, string]>): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <select class="wkf__input" data-wkf-field="${escapeHtml(field)}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${optionValue === value ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function numberField(field: string, label: string, value: number, min?: number, step?: number, max?: number): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <input class="wkf__input" type="number" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}"${numericAttrs(min, max, step)}>
    </label>
  `;
}

function positionField(timeline: RenderTimeline, keyframe: WebKeyframe): string {
  const isTime = timeline.positionType === "time";
  return rangeNumberField(
    "position",
    isTime ? "Time" : "Percent",
    isTime ? (keyframe.time ?? 0) : (keyframe.percent ?? 0),
    0,
    isTime ? Math.max(timeline.duration ?? 1, 1) : 100,
    isTime ? 1 : 0.1,
    "wkf__field wkf__field--time",
    isTime ? "ms" : "%",
  );
}

function rangeNumberField(field: string, label: string, value: number, min: number, max: number, step: number, className: string, suffix = ""): string {
  return `
    <div class="${className}">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <div class="wkf__range-group">
        <input class="wkf__range" type="range" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
        <input class="wkf__input wkf__input--compact" type="number" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
      </div>
      ${suffix ? `<span class="wkf__subtitle">${escapeHtml(suffix)}</span>` : ""}
    </div>
  `;
}

function renderSelectableItem(action: string, index: number, active: boolean, content: string): string {
  return `<button type="button" class="wkf__keyframe-item${active ? " wkf__keyframe-item--active" : ""}" data-wkf-action="${action}" data-wkf-index="${index}">${content}</button>`;
}

function keyframeLabel(keyframe: WebKeyframe, timeline: RenderTimeline): string {
  return timeline.positionType === "time" ? `${formatNumber(keyframe.time ?? 0)}ms` : `${formatNumber(keyframe.percent ?? 0)}%`;
}

function keyframeSecondaryLabel(keyframe: WebKeyframe, timeline: RenderTimeline): string {
  if (timeline.positionType === "percent") {
    return "";
  }
  const safeDuration = (timeline.duration ?? 1) <= 0 ? 1 : (timeline.duration ?? 1);
  return `${formatNumber(((keyframe.time ?? 0) / safeDuration) * 100)}%`;
}

function keyframeSummary(keyframe: WebKeyframe, translateUnit: TranslateUnit): string {
  const parts: string[] = [];
  const hasTransform = hasKeyframeProperty(keyframe, "transform");
  const transforms = hasTransform ? getTransformOperations(keyframe) : [];
  const opacity = getOpacityValue(keyframe);
  if (hasTransform) {
    parts.push(transforms.length ? transforms.map((transform) => transformSummary(transform, translateUnit)).join(" ") : "transform: none");
  }
  if (typeof opacity === "number" && Number.isFinite(opacity)) {
    parts.push(`opacity ${formatNumber(opacity)}`);
  }
  if (typeof keyframe.timingFunction === "string" && keyframe.timingFunction.trim() !== "") {
    parts.push(`timingFunction ${keyframe.timingFunction.trim()}`);
  }
  return parts.join(", ");
}

function transformSummary(transform: TransformOperation, unit: TranslateUnit): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${formatNumber(transform.x)}${unit}, ${formatNumber(transform.y)}${unit})`;
    case "scale":
      return `scale(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function editTimeline(state: EditorState, defaults: WebKeyframesTimeline, run: (timeline: WebKeyframesTimeline) => void): void {
  const timeline = getSelectedTimeline(state);
  run(timeline);
  normalizeEditorState(state);
}

function editSelectedKeyframe(
  state: EditorState,
  message: string,
  run: (timeline: WebKeyframesTimeline, keyframe: WebKeyframe) => void,
  withStatus = true,
): boolean {
  const timeline = getSelectedTimeline(state);
  const keyframe = timeline.keyframes[state.selectedKeyframeIndex];
  if (!keyframe) {
    return false;
  }
  run(timeline, keyframe);
  if (withStatus && message) {
    setStatus(state, "info", message);
  }
  return true;
}

function mutateTransforms(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  message: string,
  run: (timeline: WebKeyframesTimeline) => WebKeyframesTimeline | NormalizedWebKeyframesTimeline,
): boolean {
  editTimeline(state, defaults, (timeline) => {
    timeline.keyframes = cloneTimeline(run(timeline)).keyframes;
  });
  setStatus(state, "info", message);
  return true;
}

function commitField(state: EditorState, focusSnapshot: FocusSnapshot | null): boolean {
  state.pendingFocus = focusSnapshot;
  setStatus(state, "info", "Editing timeline data.");
  return true;
}

function commitTransformField(
  state: EditorState,
  defaults: WebKeyframesTimeline,
  focusSnapshot: FocusSnapshot | null,
  action: TransformEditorAction,
): boolean {
  const changed = dispatchTransformAction(state, defaults, action);
  if (changed && focusSnapshot) {
    state.pendingFocus = focusSnapshot;
  }
  return changed;
}

function cloneSparseKeyframe(keyframe: Partial<WebKeyframe>): WebKeyframe {
  return {
    ...(typeof keyframe.percent === "number" && Number.isFinite(keyframe.percent)
      ? { percent: keyframe.percent }
      : { time: typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0 }),
    ...(typeof keyframe.timingFunction === "string" && keyframe.timingFunction.trim() ? { timingFunction: keyframe.timingFunction.trim() } : {}),
    ...(Array.isArray(keyframe.properties) ? { properties: cloneProperties(keyframe.properties) } : {}),
  };
}

function createNextTimeline(timelines: WebKeyframesTimeline[], selectedIndex: number, defaults: WebKeyframesTimeline): WebKeyframesTimeline {
  const source = timelines[selectedIndex] ? cloneTimeline(timelines[selectedIndex]) : cloneTimeline(defaults);
  return {
    animationName: uniqueAnimationName(source.animationName, timelines),
    positionType: source.positionType,
    ...(source.positionType !== "percent" && typeof source.duration === "number" ? { duration: source.duration } : {}),
    translateConfig: source.translateConfig ? { ...source.translateConfig } : undefined,
    keyframes: [],
  };
}

function createNextKeyframe(timeline: WebKeyframesTimeline, selectedIndex: number): WebKeyframe {
  const positionType = timeline.positionType;
  const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
  const keyframes = sortKeyframes(timeline.keyframes, positionType);
  if (!keyframes.length) {
    return positionType === "time" ? { time: 0, properties: [] } : { percent: 0, properties: [] };
  }
  if (keyframes.length === 1) {
    return positionType === "time"
      ? { time: getPosition(keyframes[0], positionType) <= 0 ? maxPosition : 0, properties: [] }
      : { percent: getPosition(keyframes[0], positionType) <= 0 ? maxPosition : 0, properties: [] };
  }
  const selected = keyframes[selectedIndex] ?? keyframes[keyframes.length - 1];
  const next = keyframes[selectedIndex + 1];
  const previous = keyframes[selectedIndex - 1];
  const selectedPosition = getPosition(selected, positionType);
  const position = next
    ? roundPosition((selectedPosition + getPosition(next, positionType)) / 2, positionType)
    : previous
      ? roundPosition(Math.min(maxPosition, (selectedPosition + maxPosition) / 2), positionType)
      : Math.min(maxPosition, selectedPosition);
  return positionType === "time" ? { time: position, properties: [] } : { percent: position, properties: [] };
}

function parseTransformField(field: string):
  | { type: "kind"; index: number }
  | { type: "value"; index: number; field: TransformValueField }
  | null {
  const match = /^transform-(kind|x|y|value)-(\d+)$/.exec(field);
  return !match ? null : match[1] === "kind" ? { type: "kind", index: Number(match[2]) } : { type: "value", field: match[1] as TransformValueField, index: Number(match[2]) };
}

function convertKeyframesToPercent(timeline: WebKeyframesTimeline, fallbackDuration: number): void {
  const duration = Math.max(timeline.duration ?? fallbackDuration, 1);
  timeline.positionType = "percent";
  delete timeline.duration;
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const next = { ...keyframe };
    applyPosition(next, "percent", clampNumber((getPosition(next, "time") / duration) * 100, 0, 100));
    return next;
  });
}

function convertKeyframesToTime(timeline: WebKeyframesTimeline, duration: number): void {
  timeline.positionType = "time";
  timeline.duration = Math.max(1, Math.round(duration));
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const next = { ...keyframe };
    applyPosition(next, "time", clampNumber(Math.round((getPosition(next, "percent") / 100) * (timeline.duration ?? 1)), 0, timeline.duration ?? 1));
    return next;
  });
}

function uniqueAnimationName(seed: string, timelines: WebKeyframesTimeline[]): string {
  const existing = new Set(timelines.map((timeline) => timeline.animationName));
  if (!existing.has(seed)) {
    return seed;
  }
  let index = 2;
  while (existing.has(`${seed}-${index}`)) {
    index += 1;
  }
  return `${seed}-${index}`;
}

function sortKeyframes<T extends Partial<WebKeyframe>>(keyframes: T[], positionType: KeyframePositionMode): T[] {
  return [...keyframes].sort((left, right) => getPosition(left, positionType) - getPosition(right, positionType));
}

function getPosition(keyframe: Partial<WebKeyframe>, positionType: KeyframePositionMode): number {
  return positionType === "time"
    ? (typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0)
    : (typeof keyframe.percent === "number" && Number.isFinite(keyframe.percent) ? keyframe.percent : 0);
}

function applyPosition(keyframe: WebKeyframe, positionType: KeyframePositionMode, value: number): void {
  if (positionType === "time") {
    keyframe.time = Math.round(value);
    delete keyframe.percent;
  } else {
    keyframe.percent = roundPosition(value, positionType);
    delete keyframe.time;
  }
}

function roundPosition(value: number, positionType: KeyframePositionMode): number {
  return positionType === "time" ? Math.round(value) : Math.round(value * 10) / 10;
}

function clampIndex(index: number, length: number): number {
  return length <= 0 ? 0 : clampNumber(Number.isFinite(index) ? Math.round(index) : 0, 0, length - 1);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function numericAttrs(min?: number, max?: number, step?: number): string {
  return `${typeof min === "number" ? ` min="${min}"` : ""}${typeof max === "number" ? ` max="${max}"` : ""}${typeof step === "number" ? ` step="${step}"` : ""}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

function isTranslateUnit(value: unknown): value is TranslateUnit {
  return TRANSLATE_OPTIONS.includes(value as TranslateUnit);
}

export function setStatus(state: EditorState, tone: StatusTone, message: string): void {
  state.statusTone = tone;
  state.statusMessage = message;
}
