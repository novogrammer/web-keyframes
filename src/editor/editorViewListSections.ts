import { formatNumber } from "../core/generateCss.js";
import type { EditorRenderState } from "./editorViewPrimitives.js";
import {
  escapeHtml,
  formatKeyframePositionLabel,
  formatKeyframeSecondaryLabel,
  formatKeyframeSummary,
  formatTimelinePositionSummary,
  formatTimelineSummary,
} from "./editorViewPrimitives.js";

export function renderTimelineListSection(
  renderState: EditorRenderState,
  selectedTimelineIndex: number,
): string {
  const { renderTimelines } = renderState;
  return `
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Timelines</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <button type="button" class="wkf__button wkf__button--small" data-wkf-action="add-timeline">Add</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-timeline">Duplicate</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-timeline" ${
            renderTimelines.length <= 1 ? "disabled" : ""
          }>Delete</button>
        </div>
      </div>
      <div class="wkf__keyframe-list">
        ${renderTimelines
          .map(
            (timeline, index) => `
              <button
                type="button"
                class="wkf__keyframe-item${index === selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}"
                data-wkf-action="select-timeline"
                data-wkf-index="${index}"
              >
                <span class="wkf__keyframe-time">${escapeHtml(timeline.animationName)}</span>
                <span class="wkf__keyframe-percent">${escapeHtml(formatTimelinePositionSummary(timeline))}</span>
                <span class="wkf__keyframe-meta">${escapeHtml(formatTimelineSummary(timeline))}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

export function renderKeyframeListSection(
  renderState: EditorRenderState,
  selectedKeyframeIndex: number,
): string {
  const { selectedTimeline, selectedSourceTimeline } = renderState;
  return `
    <div class="wkf__section wkf__section--list">
      <div class="wkf__section-head">
        <div class="wkf__section-title">Keyframes</div>
        <div class="wkf__inline-actions wkf__inline-actions--wrap">
          <button type="button" class="wkf__button wkf__button--small" data-wkf-action="add-keyframe">Add</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-keyframe" ${
            selectedTimeline.keyframes.length === 0 ? "disabled" : ""
          }>Duplicate</button>
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-keyframe" ${
            selectedTimeline.keyframes.length === 0 ? "disabled" : ""
          }>Delete</button>
        </div>
      </div>
      <div class="wkf__keyframe-list">
        ${
          selectedTimeline.keyframes.length > 0
            ? selectedTimeline.keyframes
              .map(
                (keyframe, index) => `
                  <button
                    type="button"
                    class="wkf__keyframe-item${index === selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}"
                    data-wkf-action="select-keyframe"
                    data-wkf-index="${index}"
                  >
                    <span class="wkf__keyframe-time">${escapeHtml(formatKeyframePositionLabel(keyframe, selectedTimeline))}</span>
                    <span class="wkf__keyframe-percent">${escapeHtml(formatKeyframeSecondaryLabel(keyframe, selectedTimeline))}</span>
                    <span class="wkf__keyframe-meta">${escapeHtml(formatKeyframeSummary(selectedSourceTimeline.keyframes[index] ?? keyframe, selectedTimeline.translateConfig))}</span>
                  </button>
                `,
              )
              .join("")
            : `<div class="wkf__keyframe-item"><span class="wkf__keyframe-meta">No keyframes yet.</span></div>`
        }
      </div>
    </div>
  `;
}
