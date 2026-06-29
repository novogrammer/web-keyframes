import type { JSX } from "preact";

import { formatNumber } from "../core/generateCss.js";
import type { TransformKind } from "../core/types.js";
import type {
  EditorAction,
  EditorState,
  EditorView,
  FocusSnapshot,
  RenderTimeline,
  ViewTransformOperation,
} from "./editorCore.js";
import {
  deriveEditorView,
  keyframeLabel,
  keyframeSecondaryLabel,
  keyframeSummary,
  TIMING_FUNCTION_PRESETS,
  TRANSFORM_BUTTONS,
  TRANSLATE_OPTIONS,
} from "./editorCore.js";

type EditorAppProps = {
  state: EditorState;
  apply: (action: EditorAction) => void;
  reset: () => void;
  hide: () => void;
  copyPayload: (kind: "json" | "css") => void;
  openPreview: (kind: "json" | "css") => void;
  closePreview: () => void;
  runPreview: () => void;
  resetPreview: () => void;
  onDragStart: (event: MouseEvent) => void;
};

export function EditorApp(props: EditorAppProps): JSX.Element {
  const view = deriveEditorView(props.state.data, props.state.selectedTimelineIndex, props.state.selectedKeyframeIndex);
  return (
    <div class="wkf__panel">
      <div class="wkf__header" data-wkf-drag-handle="true" onMouseDown={(event) => props.onDragStart(event as unknown as MouseEvent)}>
        <div>
          <p class="wkf__kicker">web-keyframes editor</p>
          <h2 class="wkf__title">Keyframe Data Editor</h2>
        </div>
        <div class="wkf__actions" data-wkf-no-drag="true">
          <button
            type="button"
            class="wkf__button wkf__button--ghost"
            data-wkf-action="reset"
            onClick={props.reset}
          >
            Reset
          </button>
          <button type="button" class="wkf__button wkf__button--ghost" data-wkf-action="hide" onClick={props.hide}>
            Hide
          </button>
        </div>
      </div>
      <div class="wkf__layout">
        <div class="wkf__columns">
          <TimelineList view={view} state={props.state} apply={props.apply} />
          <div class="wkf__section">
            <SelectedTimelineForm timeline={view.selectedTimeline} apply={props.apply} />
            <div class="wkf__columns wkf__columns--stacked">
              <KeyframeList view={view} state={props.state} apply={props.apply} />
              <SelectedKeyframeForm view={view} apply={props.apply} />
            </div>
          </div>
        </div>
      </div>
      {props.state.previewTitle
        ? (
            <div class="wkf__preview">
              <div class="wkf__preview-head">
                <div>
                  <div class="wkf__section-title">{props.state.previewTitle}</div>
                  <p class="wkf__subtitle">Current generated output</p>
                </div>
                <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview" onClick={props.closePreview}>Close</button>
              </div>
              <textarea class="wkf__preview-textarea" readOnly value={props.state.previewContent} />
            </div>
          )
        : null}
      <div class="wkf__footer" data-wkf-drag-handle="true" onMouseDown={(event) => props.onDragStart(event as unknown as MouseEvent)}>
        <p class={`wkf__note wkf__note--${props.state.statusTone}`} data-wkf-status>{props.state.statusMessage}</p>
        <div class="wkf__inline-actions">
          <ActionButton action="run-preview" label="Preview" ghost small onClick={props.runPreview} />
          <ActionButton action="reset-preview" label="Reset Preview" ghost small onClick={props.resetPreview} />
          <ActionButton action="view-json" label="View JSON" ghost small onClick={() => props.openPreview("json")} />
          <ActionButton action="view-css" label="View CSS" ghost small onClick={() => props.openPreview("css")} />
          <ActionButton action="copy-json" label="Copy JSON" ghost small onClick={() => props.copyPayload("json")} />
          <ActionButton action="copy-css" label="Copy CSS" small onClick={() => props.copyPayload("css")} />
        </div>
      </div>
    </div>
  );
}

const objectKeys = new WeakMap<object, string>();
let objectKeyCounter = 0;

function stableObjectKey(value: object | undefined, prefix: string, fallback: string): string {
  if (!value) {
    return fallback;
  }
  let key = objectKeys.get(value);
  if (!key) {
    objectKeyCounter += 1;
    key = `${prefix}-${objectKeyCounter}`;
    objectKeys.set(value, key);
  }
  return key;
}

function addTransformAction(kind: TransformKind): EditorAction {
  return { type: "transformAction", operation: "add", kind };
}

function setTimelineAnimationNameAction(value: string, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setTimelineAnimationName", value, focusSnapshot };
}

function setTimelinePositionTypeAction(value: RenderTimeline["positionType"], focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setTimelinePositionType", value, focusSnapshot };
}

function setTimelineDurationAction(value: number, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setTimelineDuration", value, focusSnapshot };
}

function setTimelineTranslateUnitAction(value: RenderTimeline["translateUnit"], focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setTimelineTranslateUnit", value, focusSnapshot };
}

function setSelectedKeyframePositionAction(value: number, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setSelectedKeyframePosition", value, focusSnapshot };
}

function setSelectedKeyframeTimingFunctionAction(value: string, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setSelectedKeyframeTimingFunction", value, focusSnapshot };
}

function clearSelectedKeyframeTimingFunctionAction(): EditorAction {
  return { type: "clearSelectedKeyframeTimingFunction" };
}

function addOpacityAction(): EditorAction {
  return { type: "addOpacity" };
}

function removeOpacityAction(): EditorAction {
  return { type: "removeOpacity" };
}

function setOpacityAction(value: number, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "setOpacity", value, focusSnapshot };
}

function deleteTransformAction(index?: number): EditorAction {
  return { type: "transformAction", operation: "delete", index };
}

function moveTransformAction(index: number, direction: -1 | 1): EditorAction {
  return { type: "transformAction", operation: "move", index, direction };
}

function changeTransformKindAction(index: number, kind: TransformKind, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "transformAction", operation: "changeKind", index, kind, focusSnapshot };
}

function changeTransformValueAction(index: number, field: "x" | "y" | "value", value: number, focusSnapshot?: FocusSnapshot | null): EditorAction {
  return { type: "transformAction", operation: "changeValue", index, field, value, focusSnapshot };
}

function TimelineList({ view, state, apply }: { view: EditorView; state: EditorState; apply: EditorAppProps["apply"] }) {
  return (
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Timelines</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <ActionButton action="add-timeline" label="Add" small onClick={() => apply({ type: "collectionAction", target: "timeline", operation: "add" })} />
          <ActionButton action="duplicate-timeline" label="Duplicate" ghost small onClick={() => apply({ type: "collectionAction", target: "timeline", operation: "duplicate" })} />
          <ActionButton action="delete-timeline" label="Delete" ghost small disabled={view.timelines.length <= 1} onClick={() => apply({ type: "collectionAction", target: "timeline", operation: "delete" })} />
        </div>
      </div>
      <div class="wkf__keyframe-list">
        {view.timelines.map((timeline, index) => (
          <button
            key={stableObjectKey(state.data.timelines[index], "timeline", `timeline-fallback-${index}`)}
            type="button"
            class={`wkf__keyframe-item${index === state.selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}`}
            data-wkf-action="select-timeline"
            onClick={() => apply({ type: "collectionAction", target: "timeline", operation: "select", index })}
          >
            <span class="wkf__keyframe-time">{timeline.animationName}</span>
            <span class="wkf__keyframe-percent">{timeline.positionType === "time" ? `${String(timeline.duration ?? 1)}ms` : "percent mode"}</span>
            <span class="wkf__keyframe-meta">{`${timeline.keyframes.length} keyframes`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectedTimelineForm({ timeline, apply }: { timeline: RenderTimeline; apply: EditorAppProps["apply"] }) {
  return (
    <div class="wkf__section">
      <div class="wkf__section-title">Selected Timeline</div>
      <div class="wkf__grid wkf__grid--meta">
        <TextField
          field="animationName"
          label="Animation Name"
          value={timeline.animationName}
          onValueInput={(value, focusSnapshot) => apply(setTimelineAnimationNameAction(value, focusSnapshot))}
        />
        <SelectField
          field="positionType"
          label="Keyframe Position"
          value={timeline.positionType}
          options={[["time", "time"], ["percent", "percent"]]}
          onValueChange={(value, focusSnapshot) => apply(setTimelinePositionTypeAction(value as RenderTimeline["positionType"], focusSnapshot))}
        />
        {timeline.positionType === "time"
          ? (
              <NumberField
                field="duration"
                label="Duration"
                value={timeline.duration ?? 1}
                min={1}
                step={1}
                onValueChange={(value, focusSnapshot) => apply(setTimelineDurationAction(value, focusSnapshot))}
              />
            )
          : null}
        <SelectField
          field="translateUnit"
          label="Translate Unit"
          value={timeline.translateUnit}
          options={TRANSLATE_OPTIONS.map((value) => [value, value])}
          onValueChange={(value, focusSnapshot) => apply(setTimelineTranslateUnitAction(value as RenderTimeline["translateUnit"], focusSnapshot))}
        />
      </div>
    </div>
  );
}

function KeyframeList({ view, state, apply }: { view: EditorView; state: EditorState; apply: EditorAppProps["apply"] }) {
  return (
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Keyframes</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <ActionButton action="add-keyframe" label="Add" small onClick={() => apply({ type: "collectionAction", target: "keyframe", operation: "add" })} />
          <ActionButton action="duplicate-keyframe" label="Duplicate" ghost small disabled={view.selectedTimeline.keyframes.length === 0} onClick={() => apply({ type: "collectionAction", target: "keyframe", operation: "duplicate" })} />
          <ActionButton action="delete-keyframe" label="Delete" ghost small disabled={view.selectedTimeline.keyframes.length === 0} onClick={() => apply({ type: "collectionAction", target: "keyframe", operation: "delete" })} />
        </div>
      </div>
      <div class="wkf__keyframe-list">
        {view.selectedTimeline.keyframes.length
          ? view.selectedTimeline.keyframes.map((keyframe, index) => (
              <button
                key={stableObjectKey(view.sourceTimeline.keyframes[index], "keyframe", `keyframe-fallback-${index}`)}
                type="button"
                class={`wkf__keyframe-item${index === state.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}`}
                data-wkf-action="select-keyframe"
                onClick={() => apply({ type: "collectionAction", target: "keyframe", operation: "select", index })}
              >
                <span class="wkf__keyframe-time">{keyframeLabel(keyframe, view.selectedTimeline)}</span>
                <span class="wkf__keyframe-percent">{keyframeSecondaryLabel(keyframe, view.selectedTimeline)}</span>
                <span class="wkf__keyframe-meta">{keyframeSummary(view.sourceTimeline.keyframes[index] ?? keyframe, view.selectedTimeline.translateUnit)}</span>
              </button>
            ))
          : <div class="wkf__keyframe-item"><span class="wkf__keyframe-meta">No keyframes yet.</span></div>}
      </div>
    </div>
  );
}

function SelectedKeyframeForm({ view, apply }: { view: EditorView; apply: EditorAppProps["apply"] }) {
  const keyframe = view.selectedKeyframe ?? view.selectedTimeline.keyframes[0];
  return (
    <div class="wkf__section wkf__section--editor">
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Selected Keyframe</div>
          <p class="wkf__subtitle">
            {view.hasKeyframe
              ? (view.selectedTimeline.positionType === "time"
                  ? `${keyframeSecondaryLabel(keyframe, view.selectedTimeline)} of timeline`
                  : `${formatNumber(keyframe.percent ?? 0)}% of timeline`)
              : "Add a keyframe to start editing."}
          </p>
        </div>
      </div>
      {view.hasKeyframe
        ? (
            <>
              <div class="wkf__grid wkf__grid--editor">
                <PositionField timeline={view.selectedTimeline} keyframe={keyframe} apply={apply} />
                <TextField
                  field="timingFunction"
                  label="Timing Function"
                  value={view.timingFunction}
                  onValueInput={(value, focusSnapshot) => apply(setSelectedKeyframeTimingFunctionAction(value, focusSnapshot))}
                />
                <div class="wkf__field wkf__field--full">
                  <span class="wkf__label">Insert Preset</span>
                  <div class="wkf__inline-actions wkf__inline-actions--wrap">
                    {TIMING_FUNCTION_PRESETS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        class="wkf__button wkf__button--small wkf__button--ghost"
                        data-wkf-action="set-timing-function"
                        onClick={() => apply(setSelectedKeyframeTimingFunctionAction(value))}
                      >
                        {value}
                      </button>
                    ))}
                    <ActionButton action="clear-timing-function" label="Clear" ghost small onClick={() => apply(clearSelectedKeyframeTimingFunctionAction())} />
                  </div>
                </div>
              </div>
              <div class="wkf__section-head wkf__section-head--properties"><div class="wkf__section-title">Properties</div></div>
              {view.opacityState !== "unset" && view.transformState !== "unset" ? null : (
                <div class="wkf__property-add">
                  <div class="wkf__inline-actions wkf__inline-actions--wrap">
                    {view.opacityState === "unset" ? <ActionButton action="add-opacity" label="+ Opacity" ghost small onClick={() => apply(addOpacityAction())} /> : null}
                    {view.transformState === "unset" ? <ActionButton action="add-transform" label="+ Transform" ghost small onClick={() => apply(addTransformAction("translate"))} /> : null}
                  </div>
                </div>
              )}
              <div class="wkf__property-list">
                {view.opacityState === "explicit"
                  ? (
                      <div class="wkf__property">
                        <div class="wkf__section-head">
                          <div>
                            <div class="wkf__section-title">Opacity</div>
                            <p class="wkf__subtitle">Set to {formatNumber(view.opacityValue ?? 1)}</p>
                          </div>
                          <div class="wkf__inline-actions">
                            <ActionButton action="delete-opacity" label="Delete" ghost small onClick={() => apply(removeOpacityAction())} />
                          </div>
                        </div>
                        <RangeNumberField
                          field="opacity"
                          label="Opacity"
                          value={view.opacityValue ?? 1}
                          min={0}
                          max={1}
                          step={0.01}
                          className="wkf__field wkf__field--full"
                          onValueInput={(value) => apply(setOpacityAction(value))}
                          onValueChange={(value, focusSnapshot) => apply(setOpacityAction(value, focusSnapshot))}
                        />
                      </div>
                    )
                  : null}
                {view.transformState !== "unset" ? <TransformsEditor state={view} apply={apply} /> : null}
              </div>
            </>
          )
        : (
            <div class="wkf__property">
              <p class="wkf__subtitle">This timeline has no keyframes yet.</p>
              <p class="wkf__subtitle">Use the Add button above to create the first keyframe.</p>
            </div>
          )}
    </div>
  );
}

function TransformsEditor({ state, apply }: { state: EditorView; apply: EditorAppProps["apply"] }) {
  return (
    <div class="wkf__property">
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        {TRANSFORM_BUTTONS.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            class="wkf__button wkf__button--small wkf__button--ghost"
            data-wkf-action="add-transform"
            onClick={() => apply(addTransformAction(kind))}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Transforms</div>
          <p class="wkf__subtitle">{state.transformState === "none" ? "None" : `${state.transforms.length} item${state.transforms.length === 1 ? "" : "s"}`}</p>
        </div>
        <div class="wkf__inline-actions">
          <ActionButton action="delete-transforms" label="Delete" ghost small onClick={() => apply(deleteTransformAction())} />
          {state.transformState === "explicit" ? <ActionButton action="clear-transforms" label="None" ghost small onClick={() => apply({ type: "transformAction", operation: "clear" })} /> : null}
        </div>
      </div>
      <div class="wkf__transform-list">
        {state.transforms.map((transform, index) => (
          <TransformEditor key={stableObjectKey(state.sourceTransforms[index], "transform", `transform-fallback-${index}`)} transform={transform} index={index} total={state.transforms.length} apply={apply} />
        ))}
      </div>
    </div>
  );
}

function TransformEditor(
  { transform, index, total, apply }: {
    transform: ViewTransformOperation;
    index: number;
    total: number;
    apply: EditorAppProps["apply"];
  },
) {
  return (
    <div class="wkf__field">
      <div class="wkf__section-head">
        <div class="wkf__inline-actions">
          <SelectField
            field={`transform-kind-${index}`}
            label={`Transform ${index + 1}`}
            value={transform.kind}
            options={[["translate", "translate"], ["scale", "scale"], ["rotate", "rotate"], ["skew", "skew"]]}
            onValueChange={(value, focusSnapshot) => apply(changeTransformKindAction(index, value as TransformKind, focusSnapshot))}
          />
        </div>
        <div class="wkf__inline-actions">
          <ActionButton action="move-transform-up" label="Up" ghost small disabled={index === 0} onClick={() => apply(moveTransformAction(index, -1))} />
          <ActionButton action="move-transform-down" label="Down" ghost small disabled={index === total - 1} onClick={() => apply(moveTransformAction(index, 1))} />
          <ActionButton action="delete-transform" label="Delete" ghost small onClick={() => apply(deleteTransformAction(index))} />
        </div>
      </div>
      <div class="wkf__grid wkf__grid--editor">
        {transform.kind === "translate" || transform.kind === "scale" || transform.kind === "skew"
          ? (
              <>
                <NumberField
                  field={`transform-x-${index}`}
                  label="X"
                  value={transform.x}
                  onValueChange={(value, focusSnapshot) => apply(changeTransformValueAction(index, "x", value, focusSnapshot))}
                />
                <NumberField
                  field={`transform-y-${index}`}
                  label="Y"
                  value={transform.y}
                  onValueChange={(value, focusSnapshot) => apply(changeTransformValueAction(index, "y", value, focusSnapshot))}
                />
              </>
            )
          : (
              <NumberField
                field={`transform-value-${index}`}
                label="Value"
                value={transform.value}
                onValueChange={(value, focusSnapshot) => apply(changeTransformValueAction(index, "value", value, focusSnapshot))}
              />
            )}
      </div>
    </div>
  );
}

function PositionField({ timeline, keyframe, apply }: { timeline: RenderTimeline; keyframe: RenderTimeline["keyframes"][number]; apply: EditorAppProps["apply"] }) {
  const isTime = timeline.positionType === "time";
  return (
    <RangeNumberField
      field="position"
      label={isTime ? "Time" : "Percent"}
      value={isTime ? (keyframe.time ?? 0) : (keyframe.percent ?? 0)}
      min={0}
      max={isTime ? Math.max(timeline.duration ?? 1, 1) : 100}
      step={isTime ? 1 : 0.1}
      className="wkf__field wkf__field--time"
      suffix={isTime ? "ms" : "%"}
      onValueInput={(value) => apply(setSelectedKeyframePositionAction(value))}
      onValueChange={(value, focusSnapshot) => apply(setSelectedKeyframePositionAction(value, focusSnapshot))}
    />
  );
}

function ActionButton(
  { action, label, onClick, ghost = false, small = false, disabled = false }: {
    action?: string;
    label: string;
    onClick: () => void;
    ghost?: boolean;
    small?: boolean;
    disabled?: boolean;
  },
) {
  const className = ["wkf__button", small ? "wkf__button--small" : "", ghost ? "wkf__button--ghost" : ""].filter(Boolean).join(" ");
  return <button type="button" class={className} data-wkf-action={action} disabled={disabled} onClick={onClick}>{label}</button>;
}

function TextField(
  { field, label, value, onValueInput }: {
    field: string;
    label: string;
    value: string;
    onValueInput: (value: string, focusSnapshot: FocusSnapshot | null) => void;
  },
) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <input class="wkf__input" type="text" data-wkf-field={field} value={value} onInput={(event) => onValueInput(currentValue(event), captureFocusSnapshot(event.currentTarget))} />
    </label>
  );
}

function SelectField(
  { field, label, value, options, onValueChange }: {
    field: string;
    label: string;
    value: string;
    options: ReadonlyArray<readonly [string, string]>;
    onValueChange: (value: string, focusSnapshot: FocusSnapshot | null) => void;
  },
) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <select class="wkf__input" data-wkf-field={field} value={value} onChange={(event) => onValueChange(currentValue(event), captureFocusSnapshot(event.currentTarget))}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function NumberField(
  { field, label, value, min, step, max, onValueChange }: {
    field: string;
    label: string;
    value: number;
    min?: number;
    step?: number;
    max?: number;
    onValueChange: (value: number, focusSnapshot: FocusSnapshot | null) => void;
  },
) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <input
        class="wkf__input"
        type="number"
        data-wkf-field={field}
        value={String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = Number(currentValue(event));
          if (Number.isFinite(nextValue)) {
            onValueChange(nextValue, captureFocusSnapshot(event.currentTarget));
          }
        }}
      />
    </label>
  );
}

function RangeNumberField(
  { field, label, value, min, max, step, className, suffix = "", onValueInput, onValueChange }: {
    field: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    className: string;
    suffix?: string;
    onValueInput: (value: number) => void;
    onValueChange: (value: number, focusSnapshot: FocusSnapshot | null) => void;
  },
) {
  return (
    <div class={className}>
      <span class="wkf__label">{label}</span>
      <div class="wkf__range-group">
        <input
          class="wkf__range"
          type="range"
          data-wkf-field={field}
          value={String(value)}
          min={min}
          max={max}
          step={step}
          onInput={(event) => {
            const nextValue = Number(currentValue(event));
            if (Number.isFinite(nextValue)) {
              onValueInput(nextValue);
            }
          }}
          onChange={(event) => {
            const nextValue = Number(currentValue(event));
            if (Number.isFinite(nextValue)) {
              onValueChange(nextValue, captureFocusSnapshot(event.currentTarget));
            }
          }}
        />
        <input
          class="wkf__input wkf__input--compact"
          type="number"
          data-wkf-field={field}
          value={String(value)}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const nextValue = Number(currentValue(event));
            if (Number.isFinite(nextValue)) {
              onValueChange(nextValue, captureFocusSnapshot(event.currentTarget));
            }
          }}
        />
      </div>
      {suffix ? <span class="wkf__subtitle">{suffix}</span> : null}
    </div>
  );
}

function currentValue(event: JSX.TargetedEvent<HTMLInputElement | HTMLSelectElement, Event>): string {
  return event.currentTarget.value;
}

function captureFocusSnapshot(input: HTMLInputElement | HTMLSelectElement): FocusSnapshot | null {
  const field = input.dataset.wkfField;
  if (!field) {
    return null;
  }
  const inputs = input.ownerDocument.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`);
  return {
    field,
    index: Math.max(0, Array.from(inputs).indexOf(input)),
    selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
    selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
  };
}
