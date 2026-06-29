import type { JSX } from "preact";

import { formatNumber } from "../core/generateCss.js";
import type { TransformKind } from "../core/types.js";
import type {
  EditorState,
  EditorView,
  FocusSnapshot,
  RenderTimeline,
  ViewTransformOperation,
} from "./editorCore.js";
import {
  deriveViewForState,
  keyframeLabel,
  keyframeSecondaryLabel,
  keyframeSummary,
  TIMING_FUNCTION_PRESETS,
  TRANSFORM_BUTTONS,
  TRANSLATE_OPTIONS,
} from "./editorCore.js";

type EditorAppProps = {
  state: EditorState;
  onAction: (action: string, index?: number, value?: string) => void;
  onFieldInput: (field: string, value: string, meta: InputMeta) => void;
  onFieldChange: (field: string, value: string, meta: InputMeta) => void;
  onDragStart: (event: MouseEvent) => void;
};

export type InputMeta = {
  inputType: string;
  focusSnapshot: FocusSnapshot | null;
};

export function EditorApp(props: EditorAppProps): JSX.Element {
  const view = deriveViewForState(props.state);
  return (
    <div class="wkf__panel">
      <div class="wkf__header" data-wkf-drag-handle="true" onMouseDown={(event) => props.onDragStart(event as unknown as MouseEvent)}>
        <div>
          <p class="wkf__kicker">web-keyframes editor</p>
          <h2 class="wkf__title">Keyframe Data Editor</h2>
        </div>
        <div class="wkf__actions" data-wkf-no-drag="true">
          <button type="button" class="wkf__button wkf__button--ghost" data-wkf-action="reset" onClick={() => props.onAction("reset")}>Reset</button>
          <button type="button" class="wkf__button wkf__button--ghost" data-wkf-action="hide" onClick={() => props.onAction("hide")}>Hide</button>
        </div>
      </div>
      <div class="wkf__layout">
        <div class="wkf__columns">
          <TimelineList view={view} state={props.state} onAction={props.onAction} />
          <div class="wkf__section">
            <SelectedTimelineForm timeline={view.selectedTimeline} onFieldInput={props.onFieldInput} onFieldChange={props.onFieldChange} />
            <div class="wkf__columns wkf__columns--stacked">
              <KeyframeList view={view} state={props.state} onAction={props.onAction} />
              <SelectedKeyframeForm view={view} onAction={props.onAction} onFieldInput={props.onFieldInput} onFieldChange={props.onFieldChange} />
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
                <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview" onClick={() => props.onAction("close-preview")}>Close</button>
              </div>
              <textarea class="wkf__preview-textarea" readOnly value={props.state.previewContent} />
            </div>
          )
        : null}
      <div class="wkf__footer" data-wkf-drag-handle="true" onMouseDown={(event) => props.onDragStart(event as unknown as MouseEvent)}>
        <p class={`wkf__note wkf__note--${props.state.statusTone}`} data-wkf-status>{props.state.statusMessage}</p>
        <div class="wkf__inline-actions">
          <ActionButton action="run-preview" label="Preview" onAction={props.onAction} ghost small />
          <ActionButton action="reset-preview" label="Reset Preview" onAction={props.onAction} ghost small />
          <ActionButton action="view-json" label="View JSON" onAction={props.onAction} ghost small />
          <ActionButton action="view-css" label="View CSS" onAction={props.onAction} ghost small />
          <ActionButton action="copy-json" label="Copy JSON" onAction={props.onAction} ghost small />
          <ActionButton action="copy-css" label="Copy CSS" onAction={props.onAction} small />
        </div>
      </div>
    </div>
  );
}

function TimelineList({ view, state, onAction }: { view: EditorView; state: EditorState; onAction: EditorAppProps["onAction"] }) {
  return (
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Timelines</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <ActionButton action="add-timeline" label="Add" onAction={onAction} small />
          <ActionButton action="duplicate-timeline" label="Duplicate" onAction={onAction} ghost small />
          <ActionButton action="delete-timeline" label="Delete" onAction={onAction} ghost small disabled={view.timelines.length <= 1} />
        </div>
      </div>
      <div class="wkf__keyframe-list">
        {view.timelines.map((timeline, index) => (
          <button
            key={`timeline-${index}-${timeline.animationName}`}
            type="button"
            class={`wkf__keyframe-item${index === state.selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}`}
            data-wkf-action="select-timeline"
            onClick={() => onAction("select-timeline", index)}
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

function SelectedTimelineForm(
  { timeline, onFieldInput, onFieldChange }: {
    timeline: RenderTimeline;
    onFieldInput: EditorAppProps["onFieldInput"];
    onFieldChange: EditorAppProps["onFieldChange"];
  },
) {
  return (
    <div class="wkf__section">
      <div class="wkf__section-title">Selected Timeline</div>
      <div class="wkf__grid wkf__grid--meta">
        <TextField field="animationName" label="Animation Name" value={timeline.animationName} onInput={onFieldInput} />
        <SelectField field="positionType" label="Keyframe Position" value={timeline.positionType} options={[["time", "time"], ["percent", "percent"]]} onChange={onFieldChange} />
        {timeline.positionType === "time" ? <NumberField field="duration" label="Duration" value={timeline.duration ?? 1} min={1} step={1} onChange={onFieldChange} /> : null}
        <SelectField field="translateUnit" label="Translate Unit" value={timeline.translateUnit} options={TRANSLATE_OPTIONS.map((value) => [value, value])} onChange={onFieldChange} />
      </div>
    </div>
  );
}

function KeyframeList({ view, state, onAction }: { view: EditorView; state: EditorState; onAction: EditorAppProps["onAction"] }) {
  return (
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Keyframes</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <ActionButton action="add-keyframe" label="Add" onAction={onAction} small />
          <ActionButton action="duplicate-keyframe" label="Duplicate" onAction={onAction} ghost small disabled={view.selectedTimeline.keyframes.length === 0} />
          <ActionButton action="delete-keyframe" label="Delete" onAction={onAction} ghost small disabled={view.selectedTimeline.keyframes.length === 0} />
        </div>
      </div>
      <div class="wkf__keyframe-list">
        {view.selectedTimeline.keyframes.length
          ? view.selectedTimeline.keyframes.map((keyframe, index) => (
              <button
                key={`keyframe-${index}-${keyframeLabel(keyframe, view.selectedTimeline)}`}
                type="button"
                class={`wkf__keyframe-item${index === state.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}`}
                data-wkf-action="select-keyframe"
                onClick={() => onAction("select-keyframe", index)}
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

function SelectedKeyframeForm(
  { view, onAction, onFieldInput, onFieldChange }: {
    view: EditorView;
    onAction: EditorAppProps["onAction"];
    onFieldInput: EditorAppProps["onFieldInput"];
    onFieldChange: EditorAppProps["onFieldChange"];
  },
) {
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
                <PositionField timeline={view.selectedTimeline} keyframe={keyframe} onFieldInput={onFieldInput} onFieldChange={onFieldChange} />
                <TextField field="timingFunction" label="Timing Function" value={view.timingFunction} onInput={onFieldInput} />
                <div class="wkf__field wkf__field--full">
                  <span class="wkf__label">Insert Preset</span>
                  <div class="wkf__inline-actions wkf__inline-actions--wrap">
                    {TIMING_FUNCTION_PRESETS.map((value) => (
                      <button key={value} type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="set-timing-function" onClick={() => onAction("set-timing-function", undefined, value)}>{value}</button>
                    ))}
                    <ActionButton action="clear-timing-function" label="Clear" onAction={onAction} ghost small />
                  </div>
                </div>
              </div>
              <div class="wkf__section-head wkf__section-head--properties"><div class="wkf__section-title">Properties</div></div>
              {view.opacityState !== "unset" && view.transformState !== "unset" ? null : (
                <div class="wkf__property-add">
                  <div class="wkf__inline-actions wkf__inline-actions--wrap">
                    {view.opacityState === "unset" ? <ActionButton action="add-opacity" label="+ Opacity" onAction={onAction} ghost small /> : null}
                    {view.transformState === "unset" ? <ActionButton action="add-transform" label="+ Transform" onAction={onAction} ghost small /> : null}
                  </div>
                </div>
              )}
              <div class="wkf__property-list">
                {view.opacityState === "explicit" ? (
                  <div class="wkf__property">
                    <div class="wkf__section-head">
                      <div>
                        <div class="wkf__section-title">Opacity</div>
                        <p class="wkf__subtitle">Set to {formatNumber(view.opacityValue ?? 1)}</p>
                      </div>
                      <div class="wkf__inline-actions">
                        <ActionButton action="delete-opacity" label="Delete" onAction={onAction} ghost small />
                      </div>
                    </div>
                    <RangeNumberField field="opacity" label="Opacity" value={view.opacityValue ?? 1} min={0} max={1} step={0.01} className="wkf__field wkf__field--full" onFieldInput={onFieldInput} onFieldChange={onFieldChange} />
                  </div>
                ) : null}
                {view.transformState !== "unset" ? <TransformsEditor state={view} onAction={onAction} onFieldChange={onFieldChange} /> : null}
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

function TransformsEditor({ state, onAction, onFieldChange }: { state: EditorView; onAction: EditorAppProps["onAction"]; onFieldChange: EditorAppProps["onFieldChange"] }) {
  return (
    <div class="wkf__property">
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        {TRANSFORM_BUTTONS.map(([kind, label]) => (
          <button key={kind} type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" onClick={() => onAction("add-transform", undefined, kind)}>{label}</button>
        ))}
      </div>
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Transforms</div>
          <p class="wkf__subtitle">{state.transformState === "none" ? "None" : `${state.transforms.length} item${state.transforms.length === 1 ? "" : "s"}`}</p>
        </div>
        <div class="wkf__inline-actions">
          <ActionButton action="delete-transforms" label="Delete" onAction={onAction} ghost small />
          {state.transformState === "explicit" ? <ActionButton action="clear-transforms" label="None" onAction={onAction} ghost small /> : null}
        </div>
      </div>
      <div class="wkf__transform-list">
        {state.transforms.map((transform, index) => (
          <TransformEditor key={`transform-${index}-${transform.kind}`} transform={transform} index={index} total={state.transforms.length} onAction={onAction} onFieldChange={onFieldChange} />
        ))}
      </div>
    </div>
  );
}

function TransformEditor(
  { transform, index, total, onAction, onFieldChange }: {
    transform: ViewTransformOperation;
    index: number;
    total: number;
    onAction: EditorAppProps["onAction"];
    onFieldChange: EditorAppProps["onFieldChange"];
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
            onChange={onFieldChange}
          />
        </div>
        <div class="wkf__inline-actions">
          <ActionButton action="move-transform-up" label="Up" onAction={onAction} index={index} ghost small disabled={index === 0} />
          <ActionButton action="move-transform-down" label="Down" onAction={onAction} index={index} ghost small disabled={index === total - 1} />
          <ActionButton action="delete-transform" label="Delete" onAction={onAction} index={index} ghost small />
        </div>
      </div>
      <div class="wkf__grid wkf__grid--editor">
        {transform.kind === "translate" || transform.kind === "scale" || transform.kind === "skew"
          ? (
              <>
                <NumberField field={`transform-x-${index}`} label="X" value={transform.x} onChange={onFieldChange} />
                <NumberField field={`transform-y-${index}`} label="Y" value={transform.y} onChange={onFieldChange} />
              </>
            )
          : <NumberField field={`transform-value-${index}`} label="Value" value={transform.value} onChange={onFieldChange} />}
      </div>
    </div>
  );
}

function PositionField(
  { timeline, keyframe, onFieldInput, onFieldChange }: {
    timeline: RenderTimeline;
    keyframe: RenderTimeline["keyframes"][number];
    onFieldInput: EditorAppProps["onFieldInput"];
    onFieldChange: EditorAppProps["onFieldChange"];
  },
) {
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
      onFieldInput={onFieldInput}
      onFieldChange={onFieldChange}
    />
  );
}

function ActionButton(
  { action, label, onAction, index, ghost = false, small = false, disabled = false }: {
    action: string;
    label: string;
    onAction: EditorAppProps["onAction"];
    index?: number;
    ghost?: boolean;
    small?: boolean;
    disabled?: boolean;
  },
) {
  const className = ["wkf__button", small ? "wkf__button--small" : "", ghost ? "wkf__button--ghost" : ""].filter(Boolean).join(" ");
  return <button type="button" class={className} data-wkf-action={action} disabled={disabled} onClick={() => onAction(action, index)}>{label}</button>;
}

function TextField({ field, label, value, onInput }: { field: string; label: string; value: string; onInput: EditorAppProps["onFieldInput"] }) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <input class="wkf__input" type="text" data-wkf-field={field} value={value} onInput={(event) => onInput(field, currentValue(event), toInputMeta(event))} />
    </label>
  );
}

function SelectField(
  { field, label, value, options, onChange }: {
    field: string;
    label: string;
    value: string;
    options: ReadonlyArray<readonly [string, string]>;
    onChange: EditorAppProps["onFieldChange"];
  },
) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <select class="wkf__input" data-wkf-field={field} value={value} onChange={(event) => onChange(field, currentValue(event), toInputMeta(event))}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function NumberField(
  { field, label, value, min, step, max, onChange }: {
    field: string;
    label: string;
    value: number;
    min?: number;
    step?: number;
    max?: number;
    onChange: EditorAppProps["onFieldChange"];
  },
) {
  return (
    <label class="wkf__field">
      <span class="wkf__label">{label}</span>
      <input class="wkf__input" type="number" data-wkf-field={field} value={String(value)} min={min} max={max} step={step} onChange={(event) => onChange(field, currentValue(event), toInputMeta(event))} />
    </label>
  );
}

function RangeNumberField(
  { field, label, value, min, max, step, className, suffix = "", onFieldInput, onFieldChange }: {
    field: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    className: string;
    suffix?: string;
    onFieldInput: EditorAppProps["onFieldInput"];
    onFieldChange: EditorAppProps["onFieldChange"];
  },
) {
  return (
    <div class={className}>
      <span class="wkf__label">{label}</span>
      <div class="wkf__range-group">
        <input class="wkf__range" type="range" data-wkf-field={field} value={String(value)} min={min} max={max} step={step} onInput={(event) => onFieldInput(field, currentValue(event), toInputMeta(event))} onChange={(event) => onFieldChange(field, currentValue(event), toInputMeta(event))} />
        <input class="wkf__input wkf__input--compact" type="number" data-wkf-field={field} value={String(value)} min={min} max={max} step={step} onChange={(event) => onFieldChange(field, currentValue(event), toInputMeta(event))} />
      </div>
      {suffix ? <span class="wkf__subtitle">{suffix}</span> : null}
    </div>
  );
}

function currentValue(event: JSX.TargetedEvent<HTMLInputElement | HTMLSelectElement, Event>): string {
  return event.currentTarget.value;
}

function toInputMeta(event: JSX.TargetedEvent<HTMLInputElement | HTMLSelectElement, Event>): InputMeta {
  const input = event.currentTarget;
  return {
    inputType: input.type,
    focusSnapshot: {
      field: input.dataset.wkfField ?? "",
      index: fieldIndex(input),
      selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
      selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
    },
  };
}

function fieldIndex(input: HTMLInputElement | HTMLSelectElement): number {
  const field = input.dataset.wkfField;
  if (!field) {
    return 0;
  }
  const inputs = input.ownerDocument.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`);
  return Math.max(0, Array.from(inputs).indexOf(input));
}
