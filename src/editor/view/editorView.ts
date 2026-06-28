import type { EditorRenderState } from "./editorViewPrimitives.js";
import { escapeHtml } from "./editorViewPrimitives.js";
import { renderSelectedKeyframeSection, renderSelectedTimelineSection } from "./editorViewEditorSections.js";
import { renderKeyframeListSection, renderTimelineListSection } from "./editorViewListSections.js";

export function renderEditorPanel(
  renderState: EditorRenderState,
  options: {
    selectedTimelineIndex: number;
    selectedKeyframeIndex: number;
    previewTitle: string | null;
    previewContent: string;
    statusMessage: string;
    statusTone: "info" | "success" | "error";
  },
): string {
  return `
    <div class="wkf__panel">
      ${renderHeader()}
      <div class="wkf__layout">
        <div class="wkf__columns">
          ${renderTimelineListSection(renderState, options.selectedTimelineIndex)}
          <div class="wkf__section">
            ${renderSelectedTimelineSection(renderState)}
            <div class="wkf__columns wkf__columns--stacked">
              ${renderKeyframeListSection(renderState, options.selectedKeyframeIndex)}
              ${renderSelectedKeyframeSection(renderState)}
            </div>
          </div>
        </div>
      </div>
      ${renderPreviewPanel(options.previewTitle, options.previewContent)}
      ${renderFooter(options.statusMessage, options.statusTone)}
    </div>
  `;
}

function renderHeader(): string {
  return `
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
  `;
}

function renderPreviewPanel(previewTitle: string | null, previewContent: string): string {
  if (previewTitle === null) {
    return "";
  }

  return `
    <div class="wkf__preview">
      <div class="wkf__preview-head">
        <div>
          <div class="wkf__section-title">${escapeHtml(previewTitle)}</div>
          <p class="wkf__subtitle">Current generated output</p>
        </div>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview">Close</button>
      </div>
      <textarea class="wkf__preview-textarea" readonly>${escapeHtml(previewContent)}</textarea>
    </div>
  `;
}

function renderFooter(statusMessage: string, statusTone: "info" | "success" | "error"): string {
  return `
    <div class="wkf__footer" data-wkf-drag-handle="true">
      <p class="wkf__note wkf__note--${statusTone}" data-wkf-status>${escapeHtml(statusMessage)}</p>
      <div class="wkf__inline-actions">
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="run-preview">Preview</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="reset-preview">Reset Preview</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-json">View JSON</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-css">View CSS</button>
        <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="copy-json">Copy JSON</button>
        <button type="button" class="wkf__button wkf__button--small" data-wkf-action="copy-css">Copy CSS</button>
      </div>
    </div>
  `;
}
