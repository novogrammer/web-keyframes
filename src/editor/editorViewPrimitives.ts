import { formatNumber } from "../core/generateCss.js";
import { getOpacityValue, getTransformOperations, hasKeyframeProperty } from "../core/normalize.js";
import type { TransformOperation, WebKeyframe, WebKeyframesTimeline } from "../core/types.js";
import type { deriveEditorRenderState } from "./editorModel.js";

export type EditorRenderState = ReturnType<typeof deriveEditorRenderState>;
type EditorTimelineView = EditorRenderState["selectedTimeline"];
type EditorTranslateView = EditorTimelineView["translateConfig"];

export const TIMING_FUNCTION_PRESETS = [
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderTextField(field: string, label: string, value: string): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <input class="wkf__input" type="text" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(value)}">
    </label>
  `;
}

export function renderSelectField(
  field: string,
  label: string,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <select class="wkf__input" data-wkf-field="${escapeHtml(field)}">
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}"${option.value === value ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

export function renderNumberField(
  field: string,
  label: string,
  value: number,
  min?: number,
  step?: number,
  max?: number,
): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <input
        class="wkf__input"
        type="number"
        data-wkf-field="${escapeHtml(field)}"
        value="${escapeHtml(String(value))}"
        ${min !== undefined ? `min="${min}"` : ""}
        ${max !== undefined ? `max="${max}"` : ""}
        ${step !== undefined ? `step="${step}"` : ""}
      >
    </label>
  `;
}

export function renderBoundedNumberField(
  field: string,
  label: string,
  value: number,
  min: number,
  step: number,
  max: number,
): string {
  return `
    <div class="wkf__field wkf__field--full">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <div class="wkf__time-row">
        <input class="wkf__range" type="range" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
        <input class="wkf__input" type="number" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
      </div>
    </div>
  `;
}

export function renderRangeField(
  field: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  suffix = "",
): string {
  return `
    <div class="wkf__field wkf__field--time">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <div class="wkf__time-row">
        <input class="wkf__range" type="range" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
        <input class="wkf__input" type="number" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="${step}">
      </div>
      ${suffix !== "" ? `<span class="wkf__subtitle">${escapeHtml(suffix)}</span>` : ""}
    </div>
  `;
}

export function renderTimingFunctionPresets(): string {
  return `
    <div class="wkf__field wkf__field--full">
      <span class="wkf__label">Insert Preset</span>
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        ${TIMING_FUNCTION_PRESETS.map(
          (value) =>
            `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="set-timing-function" data-wkf-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`,
        ).join("")}
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="clear-timing-function">Clear</button>
      </div>
    </div>
  `;
}

export function formatTimelineSummary(timeline: EditorTimelineView): string {
  return `${timeline.keyframes.length} keyframes`;
}

export function formatTimelinePositionSummary(timeline: EditorTimelineView): string {
  return timeline.positionType === "time"
    ? `${String(timeline.duration ?? 1)}ms`
    : "percent mode";
}

export function formatKeyframeSummary(
  keyframe: WebKeyframesTimeline["keyframes"][number],
  translateConfig: EditorTranslateView,
): string {
  const parts: string[] = [];
  const transformState = hasKeyframeProperty(keyframe, "transform");
  const transforms = transformState ? getTransformOperations(keyframe) : [];
  const opacity = getOpacityValue(keyframe);

  if (transformState) {
    parts.push(
      transforms.length > 0
        ? transforms.map((transform) => formatTransformSummary(transform, translateConfig)).join(" ")
        : "transform: none",
    );
  }

  if (typeof opacity === "number" && Number.isFinite(opacity)) {
    parts.push(`opacity ${formatNumber(opacity)}`);
  }

  if (typeof keyframe.timingFunction === "string" && keyframe.timingFunction.trim() !== "") {
    parts.push(`timingFunction ${keyframe.timingFunction.trim()}`);
  }

  return parts.join(", ");
}

export function formatTransformSummary(transform: TransformOperation, translateConfig: EditorTranslateView): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${formatSummaryTranslateValue(transform.x, translateConfig)}, ${formatSummaryTranslateValue(transform.y, translateConfig)})`;
    case "scale":
      return `scale(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function formatSummaryTranslateValue(value: number, translateConfig: EditorTranslateView): string {
  const unit = translateConfig.unit === "custom" ? translateConfig.customUnit || "px" : translateConfig.unit;
  return `${formatNumber(value)}${unit}`;
}

export function formatKeyframePositionLabel(
  keyframe: WebKeyframe,
  timeline: EditorTimelineView,
): string {
  return timeline.positionType === "time"
    ? `${formatNumber(keyframe.time ?? 0)}ms`
    : `${formatNumber(keyframe.percent ?? 0)}%`;
}

export function formatKeyframeSecondaryLabel(
  keyframe: WebKeyframe,
  timeline: EditorTimelineView,
): string {
  if (timeline.positionType === "time") {
    const safeDuration = (timeline.duration ?? 1) <= 0 ? 1 : (timeline.duration ?? 1);
    return `${formatNumber(((keyframe.time ?? 0) / safeDuration) * 100)}%`;
  }

  return "";
}

export function formatSelectedKeyframeSubtitle(
  keyframe: WebKeyframe,
  timeline: EditorTimelineView,
): string {
  if (timeline.positionType === "time") {
    return `${formatKeyframeSecondaryLabel(keyframe, timeline)} of timeline`;
  }

  return `${formatNumber(keyframe.percent ?? 0)}% of timeline`;
}

export function renderTransformEditor(transform: TransformOperation, index: number, total: number): string {
  return `
    <div class="wkf__field">
      <div class="wkf__section-head">
        <div class="wkf__inline-actions">
          ${renderSelectField(`transform-kind-${index}`, `Transform ${index + 1}`, transform.kind, [
            { value: "translate", label: "translate" },
            { value: "scale", label: "scale" },
            { value: "rotate", label: "rotate" },
            { value: "skew", label: "skew" },
          ])}
        </div>
        <div class="wkf__inline-actions">
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="move-transform-up" data-wkf-index="${index}" ${index === 0 ? "disabled" : ""}>Up</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="move-transform-down" data-wkf-index="${index}" ${index === total - 1 ? "disabled" : ""}>Down</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-transform" data-wkf-index="${index}">Delete</button>
        </div>
      </div>
      <div class="wkf__grid wkf__grid--editor">
        ${renderTransformFields(transform, index)}
      </div>
    </div>
  `;
}

function renderTransformFields(transform: TransformOperation, index: number): string {
  switch (transform.kind) {
    case "translate":
      return `${renderNumberField(`transform-x-${index}`, "X", transform.x)}${renderNumberField(`transform-y-${index}`, "Y", transform.y)}`;
    case "scale":
      return `${renderNumberField(`transform-x-${index}`, "Scale X", transform.x, 0.001, 0.001)}${renderNumberField(`transform-y-${index}`, "Scale Y", transform.y, 0.001, 0.001)}`;
    case "rotate":
      return renderNumberField(`transform-value-${index}`, "Rotate", transform.value, undefined, 0.1);
    case "skew":
      return `${renderNumberField(`transform-x-${index}`, "Skew X", transform.x, undefined, 0.1)}${renderNumberField(`transform-y-${index}`, "Skew Y", transform.y, undefined, 0.1)}`;
  }
}
