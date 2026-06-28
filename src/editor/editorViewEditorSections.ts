import { formatNumber } from "../core/generateCss.js";
import type { TransformOperation, WebKeyframe } from "../core/types.js";
import type { EditorRenderState } from "./editorViewPrimitives.js";
import {
  escapeHtml,
  formatSelectedKeyframeSubtitle,
  renderBoundedNumberField,
  renderNumberField,
  renderRangeField,
  renderSelectField,
  renderTextField,
  renderTimingFunctionPresets,
  renderTransformEditor,
} from "./editorViewPrimitives.js";

export function renderSelectedTimelineSection({ selectedTimeline }: EditorRenderState): string {
  return `
    <div class="wkf__section">
      <div class="wkf__section-title">Selected Timeline</div>
      <div class="wkf__grid wkf__grid--meta">
        ${renderTextField("animationName", "Animation Name", selectedTimeline.animationName)}
        ${renderSelectField("positionType", "Keyframe Position", selectedTimeline.positionType, [
          { value: "time", label: "time" },
          { value: "percent", label: "percent" },
        ])}
        ${
          selectedTimeline.positionType === "time"
            ? renderNumberField("duration", "Duration", selectedTimeline.duration ?? 1, 1, 1)
            : ""
        }
        ${renderSelectField("translateUnit", "Translate Unit", selectedTimeline.translateConfig.unit, [
          { value: "px", label: "px" },
          { value: "vw", label: "vw" },
          { value: "vh", label: "vh" },
          { value: "vmin", label: "vmin" },
          { value: "vmax", label: "vmax" },
          { value: "%", label: "%" },
          { value: "em", label: "em" },
          { value: "rem", label: "rem" },
        ])}
      </div>
    </div>
  `;
}

export function renderSelectedKeyframeSection(renderState: EditorRenderState): string {
  const {
    selectedTimeline,
    selectedKeyframe,
    hasSelectedKeyframe,
    opacitySourceState,
    selectedSourceOpacity,
    selectedSourceTransforms,
    selectedTimingFunction,
    transformSourceState,
  } = renderState;
  const resolvedSelectedKeyframe = selectedKeyframe ?? selectedTimeline.keyframes[0];

  return `
    <div class="wkf__section wkf__section--editor">
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Selected Keyframe</div>
          <p class="wkf__subtitle">${
            hasSelectedKeyframe
              ? escapeHtml(formatSelectedKeyframeSubtitle(resolvedSelectedKeyframe, selectedTimeline))
              : "Add a keyframe to start editing."
          }</p>
        </div>
      </div>
      ${
        hasSelectedKeyframe
          ? renderSelectedKeyframeEditor(
            selectedTimeline,
            resolvedSelectedKeyframe,
            selectedTimingFunction,
            opacitySourceState,
            selectedSourceOpacity,
            transformSourceState,
            selectedSourceTransforms,
          )
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

function renderSelectedKeyframeEditor(
  selectedTimeline: EditorRenderState["selectedTimeline"],
  selectedKeyframe: WebKeyframe,
  selectedTimingFunction: string,
  opacitySourceState: EditorRenderState["opacitySourceState"],
  selectedSourceOpacity: number | null,
  transformSourceState: EditorRenderState["transformSourceState"],
  selectedSourceTransforms: TransformOperation[],
): string {
  return `
    <div class="wkf__grid wkf__grid--editor">
      ${renderRangeField(
        "position",
        selectedTimeline.positionType === "time" ? "Time" : "Percent",
        selectedTimeline.positionType === "time" ? (selectedKeyframe.time ?? 0) : (selectedKeyframe.percent ?? 0),
        0,
        selectedTimeline.positionType === "time" ? Math.max(selectedTimeline.duration ?? 1, 1) : 100,
        selectedTimeline.positionType === "time" ? 1 : 0.1,
        selectedTimeline.positionType === "time" ? "ms" : "%",
      )}
      ${renderTextField("timingFunction", "Timing Function", selectedTimingFunction)}
      ${renderTimingFunctionPresets()}
    </div>
    <div class="wkf__section-head wkf__section-head--properties">
      <div class="wkf__section-title">Properties</div>
    </div>
    ${renderKeyframePropertyActions(opacitySourceState, transformSourceState)}
    <div class="wkf__property-list">
      ${renderOpacityProperty(opacitySourceState, selectedSourceOpacity)}
      ${renderTransformProperty(transformSourceState, selectedSourceTransforms)}
    </div>
  `;
}

function renderKeyframePropertyActions(
  opacitySourceState: EditorRenderState["opacitySourceState"],
  transformSourceState: EditorRenderState["transformSourceState"],
): string {
  if (opacitySourceState !== "unset" && transformSourceState !== "unset") {
    return "";
  }

  return `
    <div class="wkf__property-add">
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        ${
          opacitySourceState === "unset"
            ? `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-opacity">+ Opacity</button>`
            : ""
        }
        ${
          transformSourceState === "unset"
            ? `<button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform">+ Transform</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderOpacityProperty(
  opacitySourceState: EditorRenderState["opacitySourceState"],
  selectedSourceOpacity: number | null,
): string {
  if (opacitySourceState !== "explicit") {
    return "";
  }

  return `
    <div class="wkf__property">
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Opacity</div>
          <p class="wkf__subtitle">Set to ${escapeHtml(formatNumber(selectedSourceOpacity ?? 1))}</p>
        </div>
        <div class="wkf__inline-actions">
          <button
            type="button"
            class="wkf__button wkf__button--small wkf__button--ghost"
            data-wkf-action="delete-opacity"
          >Delete</button>
        </div>
      </div>
      ${renderBoundedNumberField("opacity", "Opacity", selectedSourceOpacity ?? 1, 0, 0.01, 1)}
    </div>
  `;
}

function renderTransformProperty(
  transformSourceState: EditorRenderState["transformSourceState"],
  selectedSourceTransforms: TransformOperation[],
): string {
  if (transformSourceState === "unset") {
    return "";
  }

  return `
    <div class="wkf__property">
      <div class="wkf__inline-actions wkf__inline-actions--wrap">
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="translate">+ Translate</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="scale">+ Scale</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="rotate">+ Rotate</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="skew">+ Skew</button>
      </div>
      ${renderTransformPropertySummary(transformSourceState, selectedSourceTransforms.length)}
      <div class="wkf__transform-list">
        ${selectedSourceTransforms.map((transform, index) => renderTransformEditor(transform, index, selectedSourceTransforms.length)).join("")}
      </div>
    </div>
  `;
}

function renderTransformPropertySummary(
  transformSourceState: EditorRenderState["transformSourceState"],
  transformCount: number,
): string {
  if (transformSourceState === "none") {
    return `
      <div class="wkf__section-head">
        <div>
          <div class="wkf__section-title">Transforms</div>
          <p class="wkf__subtitle">None</p>
        </div>
        <div class="wkf__inline-actions">
          <button
            type="button"
            class="wkf__button wkf__button--small wkf__button--ghost"
            data-wkf-action="delete-transforms"
          >Delete</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="wkf__section-head">
      <div>
        <div class="wkf__section-title">Transforms</div>
        <p class="wkf__subtitle">${transformCount} item${transformCount === 1 ? "" : "s"}</p>
      </div>
      <div class="wkf__inline-actions">
        <button
          type="button"
          class="wkf__button wkf__button--small wkf__button--ghost"
          data-wkf-action="delete-transforms"
        >Delete</button>
        <button
          type="button"
          class="wkf__button wkf__button--small wkf__button--ghost"
          data-wkf-action="clear-transforms"
        >None</button>
      </div>
    </div>
  `;
}
