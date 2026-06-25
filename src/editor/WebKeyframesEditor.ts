import {
  cloneDocument,
  cloneTimeline,
  createOpacityProperty,
  createDefaultTransform,
  createTransformProperty,
  DEFAULT_TRANSLATE_CONFIG,
  deleteKeyframeProperty,
  formatNumber,
  generateCss,
  getOpacityValue,
  getTimelinePositionType,
  getTransformOperations,
  hasKeyframeProperty,
  upsertKeyframeProperty,
} from "../core/index.js";
import type {
  TransformKind,
  TransformOperation,
  TranslateUnit,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/index.js";
import {
  addTransformToSelectedKeyframe,
  applyEditorKeyframePosition,
  clampIndex,
  clampNumber,
  cloneSparseKeyframe,
  createDuplicatedTimeline,
  createNextKeyframe,
  createNextTimeline,
  deriveEditorRenderState,
  findClosestKeyframeIndex,
  formatKeyframePositionLabel,
  formatKeyframeSecondaryLabel,
  formatKeyframeSummary,
  formatSelectedKeyframeSubtitle,
  formatTimelinePositionSummary,
  formatTimelineSummary,
  getEditorKeyframePosition,
  moveSelectedKeyframeTransform,
  removeSelectedKeyframeTransform,
  replaceSelectedKeyframeTransformKind,
  roundEditorPosition,
  sanitizeEditorDocument,
  updateSelectedKeyframeTransform,
} from "./editorModel.js";
import type { RenderTranslateConfig, RenderWebKeyframesTimeline } from "./editorModel.js";
import { applyPreview, clearAppliedPreview } from "./previewRuntime.js";
import type { ActivePreview } from "./previewRuntime.js";
import "./litDocumentShim.js";
const { html, render } = await import("lit");

export type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
};

const DEFAULT_TIMELINE_DATA: WebKeyframesTimeline = {
  id: "new-animation",
  positionType: "percent",
  translateConfig: {
    unit: DEFAULT_TRANSLATE_CONFIG.unit,
  },
  keyframes: [
    {
      percent: 0,
      properties: [
        createOpacityProperty(0),
        createTransformProperty([
          { kind: "translate", x: 0, y: 40 },
          { kind: "scale", x: 1, y: 1 },
          { kind: "rotate", value: 0 },
        ]),
      ],
    },
    {
      percent: 100,
      properties: [
        createOpacityProperty(1),
        createTransformProperty([
          { kind: "translate", x: 0, y: 0 },
          { kind: "scale", x: 1, y: 1 },
          { kind: "rotate", value: 0 },
        ]),
      ],
    },
  ],
};

export const DEFAULT_EDITOR_DATA: WebKeyframesDocument = {
  timelines: [cloneTimeline(DEFAULT_TIMELINE_DATA)],
};

type ShortcutDescriptor = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

type FocusSnapshot = {
  field: string;
  index: number;
  selectionStart: number | null;
  selectionEnd: number | null;
};

type PanelPosition = {
  left: number;
  top: number;
};

type DragState = {
  pointerOffsetX: number;
  pointerOffsetY: number;
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

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly shortcut: ShortcutDescriptor | null;
  private readonly initialData: WebKeyframesDocument;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private readonly handleContainerMouseDown: (event: MouseEvent) => void;
  private readonly handleContainerClick: (event: MouseEvent) => void;
  private readonly handleContainerInput: (event: Event) => void;
  private readonly handleContainerChange: (event: Event) => void;
  private readonly handleDragMove: (event: MouseEvent) => void;
  private readonly handleDragEnd: () => void;
  private container: HTMLElement | null = null;
  private mounted = false;
  private data: WebKeyframesDocument;
  private selectedTimelineIndex = 0;
  private selectedKeyframeIndex = 0;
  private statusMessage = "Timeline order is explicit. Preview and CSS use the selected timeline or the full document consistently.";
  private statusTone: "info" | "success" | "error" = "info";
  private previewTitle: string | null = null;
  private previewContent = "";
  private pendingFocus: FocusSnapshot | null = null;
  private panelPosition: PanelPosition | null = null;
  private dragState: DragState | null = null;
  private activePreview: ActivePreview | null = null;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }

    this.root = options.root;
    this.initialData = sanitizeEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA, DEFAULT_TIMELINE_DATA);
    this.data = cloneDocument(this.initialData);
    this.shortcut = parseShortcut(options.shortcut);
    this.handleKeydown = (event) => {
      if (event.key === "Escape" && this.previewTitle !== null) {
        event.preventDefault();
        this.closePreview("Closed preview.");
        return;
      }

      if (this.shortcut !== null && matchesShortcut(event, this.shortcut)) {
        event.preventDefault();
        this.toggle();
      }
    };
    this.handleDragMove = (event) => {
      this.updateDragPosition(event);
    };
    this.handleDragEnd = () => {
      this.stopDragging();
    };
    this.handleContainerMouseDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-wkf-drag-handle='true']")) {
        return;
      }

      this.startDragging(event);
    };
    this.handleContainerClick = (event) => {
      this.onContainerClick(event);
    };
    this.handleContainerInput = (event) => {
      this.onContainerInput(event);
    };
    this.handleContainerChange = (event) => {
      this.onContainerChange(event);
    };
  }

  mount(): void {
    if (this.mounted) {
      throw new Error("mount() has already been called.");
    }

    const ownerDocument = this.root.ownerDocument;
    const container = ownerDocument.createElement("section");
    container.className = "wkf";
    container.setAttribute("aria-hidden", "true");

    this.container = container;
    this.render();
    container.addEventListener("mousedown", this.handleContainerMouseDown);
    container.addEventListener("click", this.handleContainerClick);
    container.addEventListener("input", this.handleContainerInput);
    container.addEventListener("change", this.handleContainerChange);
    this.root.append(container);
    ownerDocument.addEventListener("keydown", this.handleKeydown);

    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }

    this.disposeAppliedPreview();
    this.stopDragging();
    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
    this.container?.removeEventListener("mousedown", this.handleContainerMouseDown);
    this.container?.removeEventListener("click", this.handleContainerClick);
    this.container?.removeEventListener("input", this.handleContainerInput);
    this.container?.removeEventListener("change", this.handleContainerChange);
    this.container?.remove();
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    this.container!.classList.add("wkf--visible");
    this.container!.setAttribute("aria-hidden", "false");
  }

  hide(): void {
    this.ensureMounted();
    this.container!.classList.remove("wkf--visible");
    this.container!.setAttribute("aria-hidden", "true");
  }

  toggle(): void {
    this.ensureMounted();
    if (this.container!.classList.contains("wkf--visible")) {
      this.hide();
      return;
    }

    this.show();
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.data);
  }

  setData(data: WebKeyframesDocument): void {
    this.data = sanitizeEditorDocument(data, DEFAULT_TIMELINE_DATA);
    this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
    if (this.container !== null) {
      this.render();
    }
  }

  toJson(): string {
    return JSON.stringify(cloneDocument(this.data), null, 2);
  }

  toCss(): string {
    return generateCss(this.data);
  }

  private ensureMounted(): void {
    if (!this.mounted || this.container === null) {
      throw new Error("Editor is not mounted.");
    }
  }

  private render(): void {
    if (this.container === null) {
      return;
    }

    const renderState = deriveEditorRenderState(
      this.data,
      this.selectedTimelineIndex,
      this.selectedKeyframeIndex,
      DEFAULT_TIMELINE_DATA,
    );
    const {
      renderTimelines,
      selectedTimeline,
      selectedSourceTimeline,
      selectedKeyframe,
      hasSelectedKeyframe,
      opacitySourceState,
      selectedSourceOpacity,
      selectedSourceTransforms,
      selectedTimingFunction,
      transformSourceState,
    } = renderState;
    const resolvedSelectedKeyframe = selectedKeyframe ?? selectedTimeline.keyframes[0];
    this.selectedTimelineIndex = renderState.selectedTimelineIndex;
    this.selectedKeyframeIndex = renderState.selectedKeyframeIndex;

    const markup = `
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
                        class="wkf__keyframe-item${index === this.selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}"
                        data-wkf-action="select-timeline"
                        data-wkf-index="${index}"
                      >
                        <span class="wkf__keyframe-time">${escapeHtml(timeline.id)}</span>
                        <span class="wkf__keyframe-percent">${escapeHtml(formatTimelinePositionSummary(timeline))}</span>
                        <span class="wkf__keyframe-meta">${escapeHtml(formatTimelineSummary(timeline))}</span>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            </div>
            <div class="wkf__section">
              <div class="wkf__section">
                <div class="wkf__section-title">Selected Timeline</div>
                <div class="wkf__grid wkf__grid--meta">
                  ${renderTextField("id", "ID", selectedTimeline.id)}
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
                    { value: "%", label: "%" },
                    { value: "custom", label: "custom" },
                  ])}
                  ${
                    selectedTimeline.translateConfig.unit === "custom"
                      ? renderTextField("translateCustomUnit", "Custom Unit", selectedTimeline.translateConfig.customUnit ?? "")
                      : ""
                  }
                </div>
              </div>
              <div class="wkf__columns wkf__columns--stacked">
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
                                class="wkf__keyframe-item${index === this.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}"
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
                      ? `
                        <div class="wkf__grid wkf__grid--editor">
                          ${renderRangeField(
                            "position",
                            selectedTimeline.positionType === "time" ? "Time" : "Percent",
                            getEditorKeyframePosition(resolvedSelectedKeyframe, selectedTimeline.positionType),
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
                        ${
                          opacitySourceState === "unset" || transformSourceState === "unset"
                            ? `
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
                            `
                            : ""
                        }
                        <div class="wkf__property-list">
                          ${
                            opacitySourceState === "explicit"
                              ? `
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
                                `
                              : ""
                          }
                          ${
                            transformSourceState !== "unset"
                              ? `
                                <div class="wkf__property">
                                  <div class="wkf__inline-actions wkf__inline-actions--wrap">
                                    <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="translate">+ Translate</button>
                                    <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="scale">+ Scale</button>
                                    <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="rotate">+ Rotate</button>
                                    <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="skew">+ Skew</button>
                                  </div>
                                  ${
                                    transformSourceState === "none"
                                      ? `
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
                                      `
                                      : ""
                                  }
                                  ${
                                    transformSourceState === "explicit"
                                      ? `
                                        <div class="wkf__section-head">
                                          <div>
                                            <div class="wkf__section-title">Transforms</div>
                                            <p class="wkf__subtitle">${selectedSourceTransforms.length} item${selectedSourceTransforms.length === 1 ? "" : "s"}</p>
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
                                      `
                                      : ""
                                  }
                                  <div class="wkf__transform-list">
                                    ${selectedSourceTransforms.map((transform, index) => renderTransformEditor(transform, index, selectedSourceTransforms.length)).join("")}
                                  </div>
                                </div>
                              `
                              : ""
                          }
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
              </div>
            </div>
          </div>
        </div>
        <div data-wkf-preview-host="true"></div>
        <div class="wkf__footer" data-wkf-drag-handle="true">
          <p class="wkf__note wkf__note--${this.statusTone}" data-wkf-status>${escapeHtml(this.statusMessage)}</p>
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

    this.container.innerHTML = markup;
    this.renderPreviewHost();
    this.applyPanelPosition();
    queueMicrotask(() => this.restoreFocus());
  }

  private renderPreviewHost(): void {
    const previewHost = this.container?.querySelector<HTMLElement>("[data-wkf-preview-host='true']");
    if (!previewHost) {
      return;
    }

    render(
      this.previewTitle === null
        ? html``
        : html`
            <div class="wkf__preview">
              <div class="wkf__preview-head">
                <div>
                  <div class="wkf__section-title">${this.previewTitle}</div>
                  <p class="wkf__subtitle">Current generated output</p>
                </div>
                <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview">Close</button>
              </div>
              <textarea class="wkf__preview-textarea" readonly></textarea>
            </div>
          `,
      previewHost,
      { creationScope: previewHost.ownerDocument },
    );

    const previewTextarea = previewHost.querySelector<HTMLTextAreaElement>(".wkf__preview-textarea");
    if (previewTextarea) {
      previewTextarea.value = this.previewContent;
    }
  }

  private onContainerClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-wkf-action]");
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.wkfAction ?? "";
    switch (action) {
      case "hide":
        this.hide();
        return;
      case "reset":
        this.reset();
        return;
      case "select-timeline":
        this.selectedTimelineIndex = clampIndex(Number(actionElement.dataset.wkfIndex ?? "0"), this.data.timelines.length);
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        this.render();
        return;
      case "add-timeline": {
        const nextTimeline = createNextTimeline(this.data.timelines, this.selectedTimelineIndex, DEFAULT_TIMELINE_DATA);
        this.data = sanitizeEditorDocument({
          timelines: [...this.data.timelines, nextTimeline],
        }, DEFAULT_TIMELINE_DATA);
        this.selectedTimelineIndex = this.data.timelines.findIndex((timeline) => timeline.id === nextTimeline.id);
        this.selectedKeyframeIndex = 0;
        this.setStatus("info", "Added timeline.");
        this.render();
        return;
      }
      case "duplicate-timeline": {
        const source = this.getSelectedTimeline();
        const duplicate = createDuplicatedTimeline(source, this.data.timelines);
        const timelines = this.data.timelines.map((timeline) => cloneTimeline(timeline));
        timelines.splice(this.selectedTimelineIndex + 1, 0, duplicate);
        this.data = sanitizeEditorDocument({ timelines }, DEFAULT_TIMELINE_DATA);
        this.selectedTimelineIndex = this.selectedTimelineIndex + 1;
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        this.setStatus("info", "Duplicated timeline.");
        this.render();
        return;
      }
      case "delete-timeline":
        if (this.data.timelines.length <= 1) {
          return;
        }

        this.data = sanitizeEditorDocument({
          timelines: this.data.timelines.filter((_, index) => index !== this.selectedTimelineIndex),
        }, DEFAULT_TIMELINE_DATA);
        this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        this.setStatus("info", "Deleted timeline.");
        this.render();
        return;
      case "select-keyframe":
        this.selectedKeyframeIndex = clampIndex(Number(actionElement.dataset.wkfIndex ?? "0"), this.getSelectedTimeline().keyframes.length);
        this.render();
        return;
      case "set-timing-function": {
        const value = actionElement.dataset.wkfValue ?? "";
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        keyframe.timingFunction = value;
        this.pendingFocus = {
          field: "timingFunction",
          index: 0,
          selectionStart: value.length,
          selectionEnd: value.length,
        };
        this.setStatus("info", "Editing timeline data.");
        this.render();
        return;
      }
      case "clear-timing-function": {
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        delete keyframe.timingFunction;
        this.pendingFocus = {
          field: "timingFunction",
          index: 0,
          selectionStart: 0,
          selectionEnd: 0,
        };
        this.setStatus("info", "Editing timeline data.");
        this.render();
        return;
      }
      case "move-transform-up":
      case "move-transform-down": {
        const index = Number(actionElement.dataset.wkfIndex ?? "0");
        const direction = action === "move-transform-up" ? -1 : 1;
        this.updateSelectedTimeline((timeline) => {
          moveSelectedKeyframeTransform(timeline, this.selectedKeyframeIndex, index, direction);
        });
        this.setStatus("info", "Reordered transforms.");
        this.render();
        return;
      }
      case "delete-transform": {
        const index = Number(actionElement.dataset.wkfIndex ?? "0");
        this.updateSelectedTimeline((timeline) => {
          removeSelectedKeyframeTransform(timeline, this.selectedKeyframeIndex, index);
        });
        this.setStatus("info", "Removed transform.");
        this.render();
        return;
      }
      case "add-transform": {
        const kind = (actionElement.dataset.wkfKind ?? "translate") as TransformKind;
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (keyframe && !hasKeyframeProperty(keyframe, "transform")) {
          upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(kind)]));
          this.setStatus("info", `Added ${kind} transform.`);
          this.render();
          return;
        }

        this.updateSelectedTimeline((candidate) => {
          addTransformToSelectedKeyframe(candidate, this.selectedKeyframeIndex, kind, createDefaultTransform);
        });
        this.setStatus("info", `Added ${kind} transform.`);
        this.render();
        return;
      }
      case "add-opacity": {
        const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        upsertKeyframeProperty(keyframe, createOpacityProperty(1));
        this.setStatus("info", "Added opacity to the selected keyframe.");
        this.render();
        return;
      }
      case "delete-opacity": {
        const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        deleteKeyframeProperty(keyframe, "opacity");
        this.setStatus("info", "Deleted opacity from the selected keyframe.");
        this.render();
        return;
      }
      case "delete-transforms": {
        const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        deleteKeyframeProperty(keyframe, "transform");
        this.setStatus("info", "Deleted transforms from the selected keyframe.");
        this.render();
        return;
      }
      case "clear-transforms": {
        const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        upsertKeyframeProperty(keyframe, createTransformProperty([]));
        this.setStatus("info", "Cleared transforms to none for the selected keyframe.");
        this.render();
        return;
      }
      case "add-keyframe":
        this.updateSelectedTimeline((timeline) => {
          const positionType = getTimelinePositionType(timeline);
          const nextFrame = createNextKeyframe(timeline, timeline.keyframes, this.selectedKeyframeIndex);
          timeline.keyframes = [...timeline.keyframes, nextFrame].sort(
            (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
          );
          this.selectedKeyframeIndex = findClosestKeyframeIndex(
            timeline,
            timeline.keyframes,
            positionType === "time"
              ? ((typeof nextFrame.time === "number" ? nextFrame.time : 0) / Math.max(timeline.duration ?? 1, 1)) * 100
              : (nextFrame.percent ?? 0),
          );
        });
        this.render();
        return;
      case "delete-keyframe": {
        const timeline = this.getSelectedTimeline();
        if (timeline.keyframes.length === 0) {
          return;
        }

        this.updateSelectedTimeline((candidate) => {
          candidate.keyframes = candidate.keyframes.filter((_, index) => index !== this.selectedKeyframeIndex);
          this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, candidate.keyframes.length);
        });
        this.render();
        return;
      }
      case "duplicate-keyframe":
        this.updateSelectedTimeline((timeline) => {
          const positionType = getTimelinePositionType(timeline);
          const source = timeline.keyframes[this.selectedKeyframeIndex];
          if (!source) {
            return;
          }
          const duplicate = cloneSparseKeyframe(source);
          const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
          const offset = positionType === "time"
            ? Math.max(1, Math.round((timeline.duration ?? 1) * 0.1))
            : 10;
          const nextPosition = Math.min(maxPosition, getEditorKeyframePosition(source, positionType) + offset);
          applyEditorKeyframePosition(duplicate, positionType, nextPosition);
          timeline.keyframes = [...timeline.keyframes, duplicate].sort(
            (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
          );
          this.selectedKeyframeIndex = findClosestKeyframeIndex(
            timeline,
            timeline.keyframes,
            positionType === "time" ? (nextPosition / Math.max(timeline.duration ?? 1, 1)) * 100 : nextPosition,
          );
        });
        this.setStatus("info", "Duplicated selected keyframe.");
        this.render();
        return;
      case "copy-json":
        void this.copyPayload("json");
        return;
      case "copy-css":
        void this.copyPayload("css");
        return;
      case "run-preview":
        this.runPreview();
        return;
      case "reset-preview":
        this.resetAppliedPreview();
        return;
      case "view-json":
        this.openPreview("JSON Preview", () => this.toJson());
        return;
      case "view-css":
        this.openPreview("CSS Preview", () => this.toCss());
        return;
      case "close-preview":
        this.closePreview("Closed preview.");
        return;
    }
  }

  private onContainerInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.wkfField === undefined) {
      return;
    }

    if (target.type === "range") {
      this.handleRangeFieldInput(target.dataset.wkfField, target);
      return;
    }

    if (target.type !== "text") {
      return;
    }

    this.pendingFocus = captureFocusSnapshot(this.container, target.dataset.wkfField, target);
    switch (target.dataset.wkfField) {
      case "id":
        this.updateSelectedTimeline((timeline) => {
          timeline.id = target.value;
        });
        break;
      case "translateCustomUnit":
        this.updateSelectedTimeline((timeline) => {
          timeline.translateConfig = {
            ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
            customUnit: target.value,
          };
        });
        break;
      case "timingFunction": {
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        const trimmed = target.value.trim();
        if (trimmed === "") {
          delete keyframe.timingFunction;
        } else {
          keyframe.timingFunction = trimmed;
        }
        break;
      }
      default:
        return;
    }

    this.setStatus("info", "Editing timeline data.");
    this.render();
  }

  private onContainerChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) || target.dataset.wkfField === undefined) {
      return;
    }

    const field = target.dataset.wkfField;
    this.pendingFocus = captureFocusSnapshot(this.container, field, target);
    if (target instanceof HTMLSelectElement) {
      this.handleSelectFieldChange(field, target.value);
      return;
    }

    const value = Number(target.value);
    if (!Number.isFinite(value)) {
      return;
    }

    if (target.type === "range") {
      this.handleRangeFieldChange(field, value);
      return;
    }

    if (target.type === "number") {
      this.handleNumberFieldChange(field, value);
    }
  }

  private handleSelectFieldChange(field: string, value: string): void {
    switch (field) {
      case "positionType":
        this.updateSelectedTimeline((timeline) => {
          const nextPositionType = value === "percent" ? "percent" : "time";
          if (nextPositionType === timeline.positionType) {
            return;
          }

          if (nextPositionType === "percent") {
            const previousDuration = Math.max(timeline.duration ?? DEFAULT_TIMELINE_DATA.duration ?? 1, 1);
            timeline.positionType = "percent";
            delete timeline.duration;
            timeline.keyframes = timeline.keyframes.map((keyframe) => {
              const nextKeyframe = cloneSparseKeyframe(keyframe);
              const percent = typeof nextKeyframe.time === "number" ? (nextKeyframe.time / previousDuration) * 100 : 0;
              applyEditorKeyframePosition(nextKeyframe, "percent", clampNumber(percent, 0, 100));
              return nextKeyframe;
            });
            return;
          }

          timeline.positionType = "time";
          timeline.duration = DEFAULT_TIMELINE_DATA.duration ?? 1200;
          timeline.keyframes = timeline.keyframes.map((keyframe) => {
            const nextKeyframe = cloneSparseKeyframe(keyframe);
            const percent = typeof nextKeyframe.percent === "number" ? nextKeyframe.percent : 0;
            applyEditorKeyframePosition(
              nextKeyframe,
              "time",
              clampNumber(Math.round((percent / 100) * (timeline.duration ?? 1)), 0, timeline.duration ?? 1),
            );
            return nextKeyframe;
          });
        });
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        break;
      case "translateUnit":
        this.updateSelectedTimeline((timeline) => {
          timeline.translateConfig = {
            ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
            unit: value as TranslateUnit,
          };
        });
        break;
      default:
        if (field.startsWith("transform-kind-")) {
          const index = Number(field.replace("transform-kind-", ""));
          this.updateSelectedTimeline((timeline) => {
            replaceSelectedKeyframeTransformKind(timeline, this.selectedKeyframeIndex, index, value as TransformKind, createDefaultTransform);
          });
          break;
        }
        return;
    }

    this.setStatus("info", "Editing timeline data.");
    this.render();
  }

  private handleRangeFieldInput(field: string, input: HTMLInputElement): void {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }

    switch (field) {
      case "position":
        this.updateSelectedTimelineKeyframes((keyframes, timeline) => {
          const selected = keyframes[this.selectedKeyframeIndex];
          if (!selected) {
            return;
          }

          const positionType = getTimelinePositionType(timeline);
          const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
          applyEditorKeyframePosition(selected, positionType, clampNumber(roundEditorPosition(value, positionType), 0, maxPosition));
          keyframes.sort((left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType));
          this.selectedKeyframeIndex = keyframes.indexOf(selected);
        }, false);
        break;
      case "opacity": {
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
        this.setStatus("info", "Editing timeline data.");
        break;
      }
      default:
        return;
    }

    syncNumberFieldValues(this.container, field, value, input);
    this.setStatus("info", "Editing timeline data.");
  }

  private handleRangeFieldChange(field: string, value: number): void {
    switch (field) {
      case "position":
        this.updateSelectedTimelineKeyframes((keyframes, timeline) => {
          const selected = keyframes[this.selectedKeyframeIndex];
          if (!selected) {
            return;
          }

          const positionType = getTimelinePositionType(timeline);
          const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
          applyEditorKeyframePosition(selected, positionType, clampNumber(roundEditorPosition(value, positionType), 0, maxPosition));
          keyframes.sort((left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType));
          this.selectedKeyframeIndex = keyframes.indexOf(selected);
        }, true);
        break;
      case "opacity": {
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
        this.setStatus("info", "Editing timeline data.");
        this.render();
        break;
      }
      default:
        return;
    }
  }

  private handleNumberFieldChange(field: string, value: number): void {
    switch (field) {
      case "duration":
        this.updateSelectedTimeline((timeline) => {
          if (timeline.positionType === "percent") {
            return;
          }

          timeline.duration = Math.max(1, Math.round(value));
          timeline.keyframes = timeline.keyframes.map((keyframe) => {
            const nextKeyframe = cloneSparseKeyframe(keyframe);
            applyEditorKeyframePosition(
              nextKeyframe,
              "time",
              clampNumber(typeof nextKeyframe.time === "number" ? nextKeyframe.time : 0, 0, timeline.duration ?? 1),
            );
            return nextKeyframe;
          });
        });
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        break;
      case "position":
        this.updateSelectedTimelineKeyframes((keyframes, timeline) => {
          const selected = keyframes[this.selectedKeyframeIndex];
          if (!selected) {
            return;
          }

          const positionType = getTimelinePositionType(timeline);
          const maxPosition = positionType === "time" ? Math.max(timeline.duration ?? 1, 1) : 100;
          applyEditorKeyframePosition(selected, positionType, clampNumber(roundEditorPosition(value, positionType), 0, maxPosition));
          keyframes.sort((left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType));
          this.selectedKeyframeIndex = keyframes.indexOf(selected);
        }, true);
        return;
      case "opacity": {
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (!keyframe) {
          return;
        }

        upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
        break;
      }
      default:
        if (!this.handleTransformNumberFieldChange(field, value)) {
          return;
        }
        break;
    }

    this.setStatus("info", "Editing timeline data.");
    this.render();
  }

  private handleTransformNumberFieldChange(field: string, value: number): boolean {
    const matched = /^transform-(x|y|value)-(\d+)$/.exec(field);
    if (!matched) {
      return false;
    }

    const [, property, indexValue] = matched;
    const index = Number(indexValue);
    this.updateSelectedTimeline((timeline) => {
      if (property === "value") {
        updateSelectedKeyframeTransform(timeline, this.selectedKeyframeIndex, index, "value", value);
        return;
      }

      const axis = property === "x" ? "x" : "y";
      updateSelectedKeyframeTransform(timeline, this.selectedKeyframeIndex, index, axis, value);
    });
    return true;
  }

  private updateSelectedTimeline(update: (timeline: WebKeyframesTimeline) => void): void {
    const timeline = this.getSelectedTimeline();
    update(timeline);
    this.data = sanitizeEditorDocument(this.data, DEFAULT_TIMELINE_DATA);
    this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
  }

  private updateSelectedTimelineKeyframes(
    update: (keyframes: WebKeyframe[], timeline: WebKeyframesTimeline) => void,
    shouldRender = true,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframes = timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));

    update(keyframes, timeline);
    timeline.keyframes = keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));
    this.data = sanitizeEditorDocument(this.data, DEFAULT_TIMELINE_DATA);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
    this.setStatus("info", "Editing timeline data.");
    if (shouldRender) {
      this.render();
    }
  }

  private bindCopyActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='copy-json']")?.addEventListener("click", () => {
      void this.copyPayload("json");
    });
    this.container?.querySelector<HTMLElement>("[data-wkf-action='copy-css']")?.addEventListener("click", () => {
      void this.copyPayload("css");
    });
  }

  private bindPreviewActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='run-preview']")?.addEventListener("click", () => this.runPreview());
    this.container?.querySelector<HTMLElement>("[data-wkf-action='reset-preview']")?.addEventListener("click", () => this.resetAppliedPreview());
    this.container?.querySelector<HTMLElement>("[data-wkf-action='view-json']")?.addEventListener("click", () => {
      this.openPreview("JSON Preview", () => this.toJson());
    });
    this.container?.querySelector<HTMLElement>("[data-wkf-action='view-css']")?.addEventListener("click", () => {
      this.openPreview("CSS Preview", () => this.toCss());
    });
    this.container?.querySelector<HTMLElement>("[data-wkf-action='close-preview']")?.addEventListener("click", () => {
      this.closePreview("Closed preview.");
    });
  }

  private async copyPayload(kind: "json" | "css"): Promise<void> {
    try {
      const text = kind === "json" ? this.toJson() : this.toCss();
      await writeClipboardText(this.root.ownerDocument.defaultView, text);
      this.setStatus("success", kind === "json" ? "Copied JSON to clipboard." : "Copied CSS to clipboard.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("error", message);
    }

    this.render();
  }

  private setStatus(tone: "info" | "success" | "error", message: string): void {
    this.statusTone = tone;
    this.statusMessage = message;
  }

  private reset(): void {
    this.disposeAppliedPreview();
    this.data = cloneDocument(this.initialData);
    this.selectedTimelineIndex = 0;
    this.selectedKeyframeIndex = 0;
    this.previewTitle = null;
    this.previewContent = "";
    this.setStatus("success", "Reset editor data to the initial state.");
    this.render();
  }

  private openPreview(title: string, getContent: () => string): void {
    try {
      this.previewTitle = title;
      this.previewContent = getContent();
      this.setStatus("success", `Opened ${title.toLowerCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.previewTitle = null;
      this.previewContent = "";
      this.setStatus("error", message);
    }

    this.render();
  }

  private closePreview(message: string): void {
    this.previewTitle = null;
    this.previewContent = "";
    this.setStatus("info", message);
    this.render();
  }

  private runPreview(): void {
    try {
      const timeline = this.getSelectedTimeline();
      const ownerDocument = this.root.ownerDocument;
      this.disposeAppliedPreview();
      this.activePreview = applyPreview(ownerDocument, timeline);

      this.setStatus(
        "success",
        `Applied preview to ${this.activePreview.targets.length} element${this.activePreview.targets.length === 1 ? "" : "s"} for "${timeline.id}".`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus("error", message);
    }

    this.render();
  }

  private resetAppliedPreview(): void {
    if (this.activePreview === null) {
      this.setStatus("info", "Preview is not active.");
      this.render();
      return;
    }

    this.disposeAppliedPreview();
    this.setStatus("success", "Reset preview.");
    this.render();
  }

  private disposeAppliedPreview(): void {
    clearAppliedPreview(this.activePreview);
    this.activePreview = null;
  }

  private restoreFocus(): void {
    if (this.container === null || this.pendingFocus === null) {
      return;
    }

    const selector = `[data-wkf-field='${this.pendingFocus.field}']`;
    const inputs = this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector);
    const input = inputs[this.pendingFocus.index];
    if (!input) {
      this.pendingFocus = null;
      return;
    }

    input.focus();
    if (
      input instanceof HTMLInputElement &&
      this.pendingFocus.selectionStart !== null &&
      this.pendingFocus.selectionEnd !== null &&
      typeof input.setSelectionRange === "function"
    ) {
      input.setSelectionRange(this.pendingFocus.selectionStart, this.pendingFocus.selectionEnd);
    }

    this.pendingFocus = null;
  }

  private startDragging(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-wkf-no-drag='true'], button, input, select, textarea, label")
    ) {
      return;
    }

    const panel = this.container?.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    this.panelPosition = { left: rect.left, top: rect.top };
    this.dragState = {
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
    };

    panel.classList.add("wkf__panel--dragging");
    ownerWindow.addEventListener("mousemove", this.handleDragMove);
    ownerWindow.addEventListener("mouseup", this.handleDragEnd);
    event.preventDefault();
  }

  private updateDragPosition(event: MouseEvent): void {
    if (this.dragState === null || this.container === null) {
      return;
    }

    const panel = this.container.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const minLeft = Math.min(0, PANEL_MIN_VISIBLE_X - rect.width);
    const maxLeft = Math.max(0, ownerWindow.innerWidth - PANEL_MIN_VISIBLE_X);
    const minTop = Math.min(0, PANEL_MIN_VISIBLE_Y - rect.height);
    const maxTop = Math.max(0, ownerWindow.innerHeight - PANEL_MIN_VISIBLE_Y);
    this.panelPosition = {
      left: clampNumber(event.clientX - this.dragState.pointerOffsetX, minLeft, maxLeft),
      top: clampNumber(event.clientY - this.dragState.pointerOffsetY, minTop, maxTop),
    };
    this.applyPanelPosition();
  }

  private stopDragging(): void {
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", this.handleDragMove);
      ownerWindow.removeEventListener("mouseup", this.handleDragEnd);
    }

    this.container?.querySelector<HTMLElement>(".wkf__panel")?.classList.remove("wkf__panel--dragging");
    this.dragState = null;
  }

  private applyPanelPosition(): void {
    const panel = this.container?.querySelector<HTMLElement>(".wkf__panel");
    if (!panel) {
      return;
    }

    if (this.panelPosition === null) {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.bottom = "";
      panel.style.transform = "";
      return;
    }

    panel.style.left = `${this.panelPosition.left}px`;
    panel.style.top = `${this.panelPosition.top}px`;
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  private getSelectedTimeline(): WebKeyframesTimeline {
    return this.data.timelines[this.selectedTimelineIndex] ?? this.data.timelines[0];
  }
}

function parseShortcut(shortcut: string | false | undefined): ShortcutDescriptor | null {
  if (shortcut === false || shortcut === undefined || shortcut.trim() === "") {
    return null;
  }

  const tokens = shortcut.split("+").map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const descriptor: ShortcutDescriptor = {
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  };

  for (const token of tokens) {
    switch (token) {
      case "ctrl":
      case "control":
        descriptor.ctrlKey = true;
        break;
      case "cmd":
      case "command":
      case "meta":
        descriptor.metaKey = true;
        break;
      case "shift":
        descriptor.shiftKey = true;
        break;
      case "alt":
      case "option":
        descriptor.altKey = true;
        break;
      default:
        descriptor.key = token;
        break;
    }
  }

  if (descriptor.key === "") {
    throw new Error("shortcut must include a non-modifier key.");
  }

  return descriptor;
}

function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDescriptor): boolean {
  return (
    event.key.toLowerCase() === shortcut.key &&
    event.ctrlKey === shortcut.ctrlKey &&
    event.metaKey === shortcut.metaKey &&
    event.shiftKey === shortcut.shiftKey &&
    event.altKey === shortcut.altKey
  );
}

function renderTextField(field: string, label: string, value: string): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <input class="wkf__input" type="text" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(value)}">
    </label>
  `;
}

function renderTimingFunctionPresets(): string {
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

function renderSelectField(
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

function captureFocusSnapshot(
  container: HTMLElement | null,
  field: string,
  input: HTMLInputElement | HTMLSelectElement,
): FocusSnapshot {
  const inputs = container?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`) ?? [];
  const index = Math.max(0, Array.from(inputs).indexOf(input));

  return {
    field,
    index,
    selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
    selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
  };
}

function syncNumberFieldValues(
  container: HTMLElement | null,
  field: string,
  value: number,
  source: HTMLInputElement,
): void {
  container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`).forEach((input) => {
    if (input === source) {
      return;
    }

    input.value = String(value);
  });
}

function renderNumberField(
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

function renderNullableNumberField(
  field: string,
  label: string,
  value: number | null,
  min?: number,
  step?: number,
  max?: number,
  hideUnsetAction = false,
): string {
  return `
    <label class="wkf__field">
      <span class="wkf__field-head">
        <span class="wkf__label">${escapeHtml(label)}</span>
        ${
          hideUnsetAction
            ? ""
            : `<button
              type="button"
              class="wkf__button wkf__button--tiny wkf__button--ghost"
              data-wkf-action="delete-${escapeHtml(field)}"
              ${value == null ? "disabled" : ""}
            >Delete</button>`
        }
      </span>
      <input
        class="wkf__input"
        type="number"
        data-wkf-field="${escapeHtml(field)}"
        value="${value == null ? "" : escapeHtml(String(value))}"
        placeholder="unset"
        ${min !== undefined ? `min="${min}"` : ""}
        ${max !== undefined ? `max="${max}"` : ""}
        ${step !== undefined ? `step="${step}"` : ""}
      >
    </label>
  `;
}

function renderBoundedNumberField(
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

function renderRangeField(
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

function renderTransformEditor(transform: TransformOperation, index: number, total: number): string {
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

async function writeClipboardText(windowObject: Window | null, text: string): Promise<void> {
  const clipboard = windowObject?.navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error("Clipboard API is not available.");
  }

  await clipboard.writeText(text);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
