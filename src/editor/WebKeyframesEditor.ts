import {
  addTransform,
  cloneDocument,
  cloneTimeline,
  cloneTransform,
  createDefaultTransform,
  DEFAULT_TRANSLATE_CONFIG,
  duplicateKeyframes,
  formatNumber,
  generatePreviewCss,
  generateScss,
  moveTransform,
  normalizeTransforms,
  normalizeWebKeyframesTimeline,
  removeTransform,
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/index.js";
import type {
  NormalizedWebKeyframe,
  TransformKind,
  TransformOperation,
  TranslateUnit,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/index.js";

export type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
};

const DEFAULT_TIMELINE_DATA: WebKeyframesTimeline = {
  id: "new-animation",
  duration: 1200,
  translate: {
    unit: DEFAULT_TRANSLATE_CONFIG.unit,
  },
  keyframes: [
    {
      time: 0,
      opacity: 0,
      transforms: [
        { kind: "translate", x: 0, y: 40 },
        { kind: "scale", value: 1 },
        { kind: "rotate", value: 0 },
      ],
    },
    {
      time: 1200,
      opacity: 1,
      transforms: [
        { kind: "translate", x: 0, y: 0 },
        { kind: "scale", value: 1 },
        { kind: "rotate", value: 0 },
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

type RenderTranslateConfig = {
  unit: TranslateUnit;
  customUnit: string;
};

type RenderWebKeyframesTimeline = Omit<WebKeyframesTimeline, "translate" | "keyframes"> & {
  translate: RenderTranslateConfig;
  keyframes: NormalizedWebKeyframe[];
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

type PreviewTargetState = {
  element: HTMLElement;
  inlineAnimationName: string;
};

type ActivePreview = {
  keyframesName: string;
  styleElement: HTMLStyleElement;
  targets: PreviewTargetState[];
};

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly shortcut: ShortcutDescriptor | null;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private readonly handleDragMove: (event: MouseEvent) => void;
  private readonly handleDragEnd: () => void;
  private container: HTMLElement | null = null;
  private mounted = false;
  private data: WebKeyframesDocument;
  private selectedTimelineIndex = 0;
  private selectedKeyframeIndex = 0;
  private statusMessage = "Timeline order is explicit. Preview and SCSS use the selected timeline or the full document consistently.";
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
    this.data = sanitizeEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA);
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
    this.root.append(container);
    ownerDocument.addEventListener("keydown", this.handleKeydown);

    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }

    this.clearAppliedPreview();
    this.stopDragging();
    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
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
    this.data = sanitizeEditorDocument(data);
    this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
    if (this.container !== null) {
      this.render();
    }
  }

  toJson(): string {
    return JSON.stringify(this.getNormalizedDocumentData(), null, 2);
  }

  toScss(): string {
    return generateScss(this.data);
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

    const renderTimelines = getRenderTimelines(this.data);
    const selectedTimeline = renderTimelines[this.selectedTimelineIndex] ?? renderTimelines[0];
    const selectedSourceTimeline = this.data.timelines[this.selectedTimelineIndex] ?? this.data.timelines[0];
    this.selectedTimelineIndex = renderTimelines.indexOf(selectedTimeline);
    const selectedKeyframe = selectedTimeline.keyframes[this.selectedKeyframeIndex] ?? selectedTimeline.keyframes[0];
    const selectedSourceKeyframe = selectedSourceTimeline.keyframes[this.selectedKeyframeIndex] ?? selectedSourceTimeline.keyframes[0];
    this.selectedKeyframeIndex = selectedTimeline.keyframes.indexOf(selectedKeyframe);
    const selectedSourceTransforms = Array.isArray(selectedSourceKeyframe?.transforms) ? selectedSourceKeyframe.transforms : [];
    const transformSourceState = selectedSourceKeyframe?.transforms == null
      ? "unset"
      : selectedSourceTransforms.length === 0
        ? "none"
        : "explicit";

    this.container.innerHTML = `
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
                        <span class="wkf__keyframe-percent">${escapeHtml(String(timeline.duration))}ms</span>
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
                  ${renderNumberField("duration", "Duration", selectedTimeline.duration, 1, 1)}
                  ${renderSelectField("translateUnit", "Translate Unit", selectedTimeline.translate.unit, [
                    { value: "px", label: "px" },
                    { value: "vw", label: "vw" },
                    { value: "vh", label: "vh" },
                    { value: "%", label: "%" },
                    { value: "custom", label: "custom" },
                  ])}
                  ${
                    selectedTimeline.translate.unit === "custom"
                      ? renderTextField("translateCustomUnit", "Custom Unit", selectedTimeline.translate.customUnit ?? "")
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
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-keyframe">Duplicate</button>
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-keyframe" ${
                        selectedTimeline.keyframes.length <= 2 ? "disabled" : ""
                      }>Delete</button>
                    </div>
                  </div>
                  <div class="wkf__keyframe-list">
                    ${selectedTimeline.keyframes
                      .map(
                        (keyframe, index) => `
                          <button
                            type="button"
                            class="wkf__keyframe-item${index === this.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}"
                            data-wkf-action="select-keyframe"
                            data-wkf-index="${index}"
                          >
                            <span class="wkf__keyframe-time">${escapeHtml(String(keyframe.time))}ms</span>
                            <span class="wkf__keyframe-percent">${escapeHtml(formatPercentLabel(keyframe.time, selectedTimeline.duration))}</span>
                            <span class="wkf__keyframe-meta">${escapeHtml(formatKeyframeSummary(selectedSourceTimeline.keyframes[index] ?? keyframe, selectedTimeline.translate))}</span>
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                </div>
                <div class="wkf__section wkf__section--editor">
                  <div class="wkf__section-head">
                    <div>
                      <div class="wkf__section-title">Selected Keyframe</div>
                      <p class="wkf__subtitle">${escapeHtml(formatPercentLabel(selectedKeyframe.time, selectedTimeline.duration))} of timeline</p>
                    </div>
                  </div>
                  <div class="wkf__grid wkf__grid--editor">
                    ${renderRangeField("time", "Time", selectedKeyframe.time, 0, selectedTimeline.duration)}
                    ${renderNullableNumberField("opacity", "Opacity", selectedSourceKeyframe?.opacity ?? null, 0, 0.01, 1)}
                  </div>
                  <div class="wkf__section-head">
                    <div class="wkf__section-title">Transforms</div>
                    <div class="wkf__inline-actions">
                      <button
                        type="button"
                        class="wkf__button wkf__button--small wkf__button--ghost"
                        data-wkf-action="unset-transforms"
                        ${selectedSourceKeyframe?.transforms == null ? "disabled" : ""}
                      >Unset</button>
                      <button
                        type="button"
                        class="wkf__button wkf__button--small wkf__button--ghost"
                        data-wkf-action="clear-transforms"
                        ${Array.isArray(selectedSourceKeyframe?.transforms) && selectedSourceKeyframe.transforms.length === 0 ? "disabled" : ""}
                      >Set to none</button>
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="translate">+ Translate</button>
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="scale">+ Scale</button>
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="rotate">+ Rotate</button>
                      <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="skew">+ Skew</button>
                    </div>
                  </div>
                  ${
                    transformSourceState === "unset"
                      ? `<p class="wkf__note">Unset</p>`
                      : transformSourceState === "none"
                        ? `<p class="wkf__note">None</p>`
                        : ""
                  }
                  <div class="wkf__transform-list">
                    ${selectedSourceTransforms.map((transform, index) => renderTransformEditor(transform, index, selectedSourceTransforms.length)).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${
          this.previewTitle !== null
            ? `
              <div class="wkf__preview">
                <div class="wkf__preview-head">
                  <div>
                    <div class="wkf__section-title">${escapeHtml(this.previewTitle)}</div>
                    <p class="wkf__subtitle">Current generated output</p>
                  </div>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="close-preview">Close</button>
                </div>
                <textarea class="wkf__preview-textarea" readonly>${escapeHtml(this.previewContent)}</textarea>
              </div>
            `
            : ""
        }
        <div class="wkf__footer" data-wkf-drag-handle="true">
          <p class="wkf__note wkf__note--${this.statusTone}" data-wkf-status>${escapeHtml(this.statusMessage)}</p>
          <div class="wkf__inline-actions">
            <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="run-preview">Preview</button>
            <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="reset-preview">Reset Preview</button>
            <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-json">View JSON</button>
            <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="view-scss">View SCSS</button>
            <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="copy-json">Copy JSON</button>
            <button type="button" class="wkf__button wkf__button--small" data-wkf-action="copy-scss">Copy SCSS</button>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector<HTMLElement>("[data-wkf-action='hide']")?.addEventListener("click", () => this.hide());
    this.container.querySelector<HTMLElement>("[data-wkf-action='reset']")?.addEventListener("click", () => this.reset());

    this.bindDragging();
    this.bindTimelineSelection();
    this.bindTimelineActions();
    this.bindMetaFields();
    this.bindKeyframeSelection();
    this.bindKeyframeEditor();
    this.bindTransformEditor(selectedSourceTransforms);
    this.bindSparseKeyframeActions();
    this.bindKeyframeActions();
    this.bindCopyActions();
    this.bindPreviewActions();
    this.applyPanelPosition();
    queueMicrotask(() => this.restoreFocus());
  }

  private bindDragging(): void {
    const handles = this.container?.querySelectorAll<HTMLElement>("[data-wkf-drag-handle='true']");
    if (!handles || handles.length === 0) {
      return;
    }

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (event) => this.startDragging(event));
    });
  }

  private bindTimelineSelection(): void {
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='select-timeline']").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedTimelineIndex = clampIndex(Number(button.dataset.wkfIndex ?? "0"), this.data.timelines.length);
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
        this.render();
      });
    });
  }

  private bindTimelineActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='add-timeline']")?.addEventListener("click", () => {
      const nextTimeline = createNextTimeline(this.data.timelines, this.selectedTimelineIndex);
      this.data = sanitizeEditorDocument({
        timelines: [...this.data.timelines, nextTimeline],
      });
      this.selectedTimelineIndex = this.data.timelines.findIndex((timeline) => timeline.id === nextTimeline.id);
      this.selectedKeyframeIndex = 0;
      this.setStatus("info", "Added timeline.");
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='duplicate-timeline']")?.addEventListener("click", () => {
      const source = this.getSelectedTimeline();
      const duplicate = createDuplicatedTimeline(source, this.data.timelines);
      const timelines = this.data.timelines.map((timeline) => cloneTimeline(timeline));
      timelines.splice(this.selectedTimelineIndex + 1, 0, duplicate);
      this.data = sanitizeEditorDocument({ timelines });
      this.selectedTimelineIndex = this.selectedTimelineIndex + 1;
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
      this.setStatus("info", "Duplicated timeline.");
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='delete-timeline']")?.addEventListener("click", () => {
      if (this.data.timelines.length <= 1) {
        return;
      }

      const timelines = this.data.timelines.filter((_, index) => index !== this.selectedTimelineIndex);
      this.data = sanitizeEditorDocument({ timelines });
      this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
      this.setStatus("info", "Deleted timeline.");
      this.render();
    });
  }

  private bindMetaFields(): void {
    this.bindInputValue("id", (value) => {
      this.updateSelectedTimeline((timeline) => {
        timeline.id = value;
      });
    });
    this.bindInputValue("translateCustomUnit", (value) => {
      this.updateSelectedTimeline((timeline) => {
        timeline.translate = {
          ...(timeline.translate ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
          customUnit: value,
        };
      });
    });
    this.bindInputValue("translateUnit", (value) => {
      this.updateSelectedTimeline((timeline) => {
        timeline.translate = {
          ...(timeline.translate ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
          unit: value as TranslateUnit,
        };
      });
    });
    this.bindInputNumber("duration", (value) => {
      this.updateSelectedTimeline((timeline) => {
        timeline.duration = Math.max(1, Math.round(value));
        timeline.keyframes = timeline.keyframes.map((keyframe) => ({
          ...keyframe,
          time: Math.min(keyframe.time, timeline.duration),
        }));
      });
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
    });
  }

  private bindKeyframeSelection(): void {
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='select-keyframe']").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedKeyframeIndex = clampIndex(Number(button.dataset.wkfIndex ?? "0"), this.getSelectedTimeline().keyframes.length);
        this.render();
      });
    });
  }

  private bindKeyframeEditor(): void {
    this.bindInputNumber("time", (value, shouldRender = true) => {
      this.updateSelectedTimelineKeyframes((keyframes, timeline) => {
        const selected = keyframes[this.selectedKeyframeIndex];
        if (!selected) {
          return;
        }

        selected.time = clampNumber(Math.round(value), 0, timeline.duration);
        keyframes.sort((left, right) => left.time - right.time);
        this.selectedKeyframeIndex = keyframes.indexOf(selected);
      }, shouldRender);
    });
    this.bindNullableInputNumber("opacity", (value) => {
      const timeline = this.getSelectedTimeline();
      const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
      if (!keyframe) {
        return;
      }

      keyframe.opacity = value === null ? null : clampNumber(value, 0, 1);
      this.setStatus("info", "Editing timeline data.");
      this.render();
    });
  }

  private bindTransformEditor(selectedTransforms: TransformOperation[]): void {
    selectedTransforms.forEach((transform, index) => {
      this.bindInputValue(`transform-kind-${index}`, (value) => {
        this.updateSelectedTimeline((timeline) => {
          const nextTimeline = normalizeTimelineForEditor(replaceTransformKind(timeline, this.selectedKeyframeIndex, index, value as TransformKind));
          replaceTimelineState(timeline, nextTimeline);
        });
      });

      switch (transform.kind) {
        case "translate":
          this.bindInputNumber(`transform-x-${index}`, (value) => {
            this.updateSelectedTimeline((timeline) => {
              const nextTimeline = normalizeTimelineForEditor(setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, "x", value));
              replaceTimelineState(timeline, nextTimeline);
            });
          });
          this.bindInputNumber(`transform-y-${index}`, (value) => {
            this.updateSelectedTimeline((timeline) => {
              const nextTimeline = normalizeTimelineForEditor(setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, "y", value));
              replaceTimelineState(timeline, nextTimeline);
            });
          });
          break;
        case "scale":
        case "rotate":
          this.bindInputNumber(`transform-value-${index}`, (value) => {
            this.updateSelectedTimeline((timeline) => {
              const nextTimeline = normalizeTimelineForEditor(setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, "value", value));
              replaceTimelineState(timeline, nextTimeline);
            });
          });
          break;
        case "skew":
          this.bindInputNumber(`transform-x-${index}`, (value) => {
            this.updateSelectedTimeline((timeline) => {
              const nextTimeline = normalizeTimelineForEditor(setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, "x", value));
              replaceTimelineState(timeline, nextTimeline);
            });
          });
          this.bindInputNumber(`transform-y-${index}`, (value) => {
            this.updateSelectedTimeline((timeline) => {
              const nextTimeline = normalizeTimelineForEditor(setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, "y", value));
              replaceTimelineState(timeline, nextTimeline);
            });
          });
          break;
      }
    });

    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='move-transform-up']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.updateSelectedTimeline((timeline) => {
          const nextTimeline = normalizeTimelineForEditor(moveTransform(timeline, this.selectedKeyframeIndex, index, -1));
          replaceTimelineState(timeline, nextTimeline);
        });
        this.setStatus("info", "Reordered transforms.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='move-transform-down']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.updateSelectedTimeline((timeline) => {
          const nextTimeline = normalizeTimelineForEditor(moveTransform(timeline, this.selectedKeyframeIndex, index, 1));
          replaceTimelineState(timeline, nextTimeline);
        });
        this.setStatus("info", "Reordered transforms.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='delete-transform']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.updateSelectedTimeline((timeline) => {
          const nextTimeline = normalizeTimelineForEditor(removeTransform(timeline, this.selectedKeyframeIndex, index));
          replaceTimelineState(timeline, nextTimeline);
        });
        this.setStatus("info", "Removed transform.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='add-transform']").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = (button.dataset.wkfKind ?? "translate") as TransformKind;
        const timeline = this.getSelectedTimeline();
        const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
        if (keyframe && (!Array.isArray(keyframe.transforms) || keyframe.transforms.length === 0)) {
          keyframe.transforms = [createDefaultTransform(kind)];
          this.setStatus("info", `Added ${kind} transform.`);
          this.render();
          return;
        }

        this.updateSelectedTimeline((candidate) => {
          const nextTimeline = normalizeTimelineForEditor(addTransform(candidate, this.selectedKeyframeIndex, kind));
          replaceTimelineState(candidate, nextTimeline);
        });
        this.setStatus("info", `Added ${kind} transform.`);
        this.render();
      });
    });
  }

  private bindSparseKeyframeActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='unset-opacity']")?.addEventListener("click", () => {
      const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
      if (!keyframe) {
        return;
      }

      keyframe.opacity = null;
      this.setStatus("info", "Unset opacity for the selected keyframe.");
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='unset-transforms']")?.addEventListener("click", () => {
      const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
      if (!keyframe) {
        return;
      }

      keyframe.transforms = null;
      this.setStatus("info", "Unset transforms for the selected keyframe.");
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='clear-transforms']")?.addEventListener("click", () => {
      const keyframe = this.getSelectedTimeline().keyframes[this.selectedKeyframeIndex];
      if (!keyframe) {
        return;
      }

      keyframe.transforms = [];
      this.setStatus("info", "Cleared transforms to none for the selected keyframe.");
      this.render();
    });
  }

  private bindKeyframeActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='add-keyframe']")?.addEventListener("click", () => {
      this.updateSelectedTimeline((timeline) => {
        const nextFrame = createNextKeyframe(timeline.keyframes, this.selectedKeyframeIndex, timeline.duration);
        const nextTimeline = normalizeTimelineForEditor({
          ...timeline,
          keyframes: [...timeline.keyframes, nextFrame],
        });
        replaceTimelineState(timeline, nextTimeline);
        this.selectedKeyframeIndex = findClosestKeyframeIndex(timeline.keyframes, nextFrame.time, timeline.duration);
      });
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='delete-keyframe']")?.addEventListener("click", () => {
      const timeline = this.getSelectedTimeline();
      if (timeline.keyframes.length <= 2) {
        return;
      }

      this.updateSelectedTimeline((candidate) => {
        const nextTimeline = normalizeTimelineForEditor({
          ...candidate,
          keyframes: candidate.keyframes.filter((_, index) => index !== this.selectedKeyframeIndex),
        });
        replaceTimelineState(candidate, nextTimeline);
        this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, candidate.keyframes.length);
      });
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='duplicate-keyframe']")?.addEventListener("click", () => {
      this.updateSelectedTimeline((timeline) => {
        const nextTimeline = normalizeTimelineForEditor(duplicateKeyframes(timeline, [this.selectedKeyframeIndex]));
        replaceTimelineState(timeline, nextTimeline);
        const targetTime = Math.min(
          timeline.duration,
          (timeline.keyframes[this.selectedKeyframeIndex]?.time ?? 0) + Math.max(1, Math.round(timeline.duration * 0.1)),
        );
        this.selectedKeyframeIndex = findClosestKeyframeIndex(timeline.keyframes, targetTime, timeline.duration);
      });
      this.setStatus("info", "Duplicated selected keyframe.");
      this.render();
    });
  }

  private bindInputValue(field: string, assign: (value: string) => void): void {
    const input = this.container?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`);
    if (!input) {
      return;
    }

    const eventName = input instanceof HTMLSelectElement ? "change" : "input";
    input.addEventListener(eventName, () => {
      this.pendingFocus = captureFocusSnapshot(this.container, field, input);
      assign(input.value);
      this.setStatus("info", "Editing timeline data.");
      this.render();
    });
  }

  private bindInputNumber(field: string, assign: (value: number, shouldRender?: boolean) => void): void {
    this.container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`).forEach((input) => {
      if (input.type === "range") {
        input.addEventListener("input", () => {
          const value = Number(input.value);
          if (!Number.isFinite(value)) {
            return;
          }

          assign(value, false);
          syncNumberFieldValues(this.container, field, value, input);
          this.setStatus("info", "Editing timeline data.");
        });

        input.addEventListener("change", () => {
          const value = Number(input.value);
          if (!Number.isFinite(value)) {
            return;
          }

          this.pendingFocus = captureFocusSnapshot(this.container, field, input);
          assign(value, true);
          this.setStatus("info", "Editing timeline data.");
          this.render();
        });
        return;
      }

      input.addEventListener("change", () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
          return;
        }

        this.pendingFocus = captureFocusSnapshot(this.container, field, input);
        assign(value, true);
        this.setStatus("info", "Editing timeline data.");
        this.render();
      });
    });
  }

  private bindNullableInputNumber(field: string, assign: (value: number | null) => void): void {
    this.container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`).forEach((input) => {
      input.addEventListener("change", () => {
        this.pendingFocus = captureFocusSnapshot(this.container, field, input);
        const trimmed = input.value.trim();

        if (trimmed === "") {
          assign(null);
        } else {
          const value = Number(trimmed);
          if (!Number.isFinite(value)) {
            return;
          }
          assign(value);
        }

        this.setStatus("info", "Editing timeline data.");
        this.render();
      });
    });
  }

  private updateSelectedTimeline(update: (timeline: WebKeyframesTimeline) => void): void {
    const timeline = this.getSelectedTimeline();
    update(timeline);
    this.data = sanitizeEditorDocument(this.data);
    this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
  }

  private updateSelectedTimelineKeyframes(
    update: (keyframes: NormalizedWebKeyframe[], timeline: WebKeyframesTimeline) => void,
    shouldRender = true,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframes = normalizeWebKeyframesTimeline(timeline).keyframes.map((keyframe) => ({
      ...keyframe,
      transforms: keyframe.transforms.map(cloneTransform),
    }));

    update(keyframes, timeline);
    timeline.keyframes = keyframes.map((keyframe) => ({
      time: keyframe.time,
      opacity: keyframe.opacity,
      transforms: keyframe.transforms.map(cloneTransform),
    }));
    this.data = sanitizeEditorDocument(this.data);
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
    this.container?.querySelector<HTMLElement>("[data-wkf-action='copy-scss']")?.addEventListener("click", () => {
      void this.copyPayload("scss");
    });
  }

  private bindPreviewActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='run-preview']")?.addEventListener("click", () => this.runPreview());
    this.container?.querySelector<HTMLElement>("[data-wkf-action='reset-preview']")?.addEventListener("click", () => this.resetAppliedPreview());
    this.container?.querySelector<HTMLElement>("[data-wkf-action='view-json']")?.addEventListener("click", () => {
      this.openPreview("JSON Preview", () => this.toJson());
    });
    this.container?.querySelector<HTMLElement>("[data-wkf-action='view-scss']")?.addEventListener("click", () => {
      this.openPreview("SCSS Preview", () => this.toScss());
    });
    this.container?.querySelector<HTMLElement>("[data-wkf-action='close-preview']")?.addEventListener("click", () => {
      this.closePreview("Closed preview.");
    });
  }

  private async copyPayload(kind: "json" | "scss"): Promise<void> {
    try {
      const text = kind === "json" ? this.toJson() : this.toScss();
      await writeClipboardText(this.root.ownerDocument.defaultView, text);
      this.setStatus("success", kind === "json" ? "Copied JSON to clipboard." : "Copied SCSS to clipboard.");
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
    this.clearAppliedPreview();
    this.data = sanitizeEditorDocument(DEFAULT_EDITOR_DATA);
    this.selectedTimelineIndex = 0;
    this.selectedKeyframeIndex = 0;
    this.previewTitle = null;
    this.previewContent = "";
    this.setStatus("success", "Reset editor data to defaults.");
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
      const timeline = normalizeWebKeyframesTimeline(this.getSelectedTimeline());
      const ownerDocument = this.root.ownerDocument;
      const ownerWindow = ownerDocument.defaultView;
      if (!ownerWindow) {
        throw new Error("Preview is not available in this environment.");
      }

      this.clearAppliedPreview();

      const targets = findPreviewTargets(ownerDocument, timeline.id);
      if (targets.length === 0) {
        throw new Error(`No elements using animation-name "${timeline.id}" were found.`);
      }

      const previewName = `${timeline.id}__wkf_preview`;
      const styleElement = ensurePreviewStyleElement(ownerDocument);
      styleElement.textContent = generatePreviewCss(this.getSelectedTimeline(), previewName);

      const appliedTargets = targets.map((element) => ({
        element,
        inlineAnimationName: element.style.animationName,
      }));

      for (const target of appliedTargets) {
        const computedAnimationName = ownerWindow.getComputedStyle(target.element).animationName;
        const nextAnimationName = replaceAnimationName(computedAnimationName, timeline.id, previewName);
        target.element.style.animationName = "none";
        void target.element.offsetWidth;
        target.element.style.animationName = nextAnimationName;
      }

      this.activePreview = {
        keyframesName: previewName,
        styleElement,
        targets: appliedTargets,
      };

      this.setStatus(
        "success",
        `Applied preview to ${appliedTargets.length} element${appliedTargets.length === 1 ? "" : "s"} for "${timeline.id}".`,
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

    this.clearAppliedPreview();
    this.setStatus("success", "Reset preview.");
    this.render();
  }

  private clearAppliedPreview(): void {
    if (this.activePreview === null) {
      return;
    }

    for (const target of this.activePreview.targets) {
      target.element.style.animationName = target.inlineAnimationName;
    }

    this.activePreview.styleElement.remove();
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

  private getNormalizedDocumentData(): WebKeyframesDocument {
    return {
      timelines: this.data.timelines.map((timeline) => normalizeTimelineForEditor(timeline)),
    };
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

function normalizeTimelineForEditor(
  data: WebKeyframesTimeline | ReturnType<typeof normalizeWebKeyframesTimeline>,
): WebKeyframesTimeline {
  return cloneTimeline(normalizeWebKeyframesTimeline(cloneTimeline(data)));
}

function getRenderTimelines(data: WebKeyframesDocument): RenderWebKeyframesTimeline[] {
  return sanitizeEditorDocument(data).timelines.map((timeline) => ({
    ...timeline,
    duration: Number.isFinite(timeline.duration) && timeline.duration > 0 ? Math.round(timeline.duration) : 1,
    translate: {
      unit: timeline.translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      customUnit: timeline.translate?.unit === "custom" ? timeline.translate.customUnit?.trim() || "" : "",
    },
    keyframes: timeline.keyframes.map<NormalizedWebKeyframe>((keyframe) => ({
      time: keyframe.time,
      opacity: keyframe.opacity ?? 1,
      transforms: normalizeTransforms(keyframe).map(cloneTransform),
    })),
  }));
}

function sanitizeEditorDocument(data: WebKeyframesDocument): WebKeyframesDocument {
  const candidate = data as Partial<WebKeyframesDocument>;
  const timelines = Array.isArray(candidate.timelines) && candidate.timelines.length > 0
    ? candidate.timelines
    : DEFAULT_EDITOR_DATA.timelines;

  return {
    timelines: timelines.map((timeline, index) => sanitizeEditorTimeline(timeline, index)),
  };
}

function sanitizeEditorTimeline(data: Partial<WebKeyframesTimeline>, index: number): WebKeyframesTimeline {
  const fallback = createDefaultTimeline(index);
  const keyframes = Array.isArray(data.keyframes) && data.keyframes.length > 0
    ? data.keyframes
    : fallback.keyframes;
  const resolvedKeyframes = [...keyframes]
    .sort((left, right) => {
      const leftTime = typeof left.time === "number" && Number.isFinite(left.time) ? left.time : 0;
      const rightTime = typeof right.time === "number" && Number.isFinite(right.time) ? right.time : 0;
      return leftTime - rightTime;
    })
    .reduce<NormalizedWebKeyframe[]>((accumulator, keyframe) => {
      const previous = accumulator[accumulator.length - 1];
      accumulator.push({
        time: typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0,
        opacity: typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity)
          ? keyframe.opacity
          : previous?.opacity ?? 1,
        transforms: normalizeTransforms(keyframe, previous?.transforms ?? []).map(cloneTransform),
      });
      return accumulator;
    }, []);

  return {
    id: typeof data.id === "string" ? data.id : fallback.id,
    duration: typeof data.duration === "number" && Number.isFinite(data.duration) && data.duration > 0
      ? Math.round(data.duration)
      : fallback.duration,
    translate: {
      unit: isTranslateUnit(data.translate?.unit) ? data.translate.unit : DEFAULT_TRANSLATE_CONFIG.unit,
      customUnit: typeof data.translate?.customUnit === "string" ? data.translate.customUnit : undefined,
    },
    keyframes: resolvedKeyframes,
  };
}

function createDefaultTimeline(index: number): WebKeyframesTimeline {
  const timeline = cloneTimeline(DEFAULT_TIMELINE_DATA);
  if (index === 0) {
    return timeline;
  }

  timeline.id = `${DEFAULT_TIMELINE_DATA.id}-${index + 1}`;
  return timeline;
}

function createNextTimeline(
  timelines: WebKeyframesTimeline[],
  selectedIndex: number,
): WebKeyframesTimeline {
  const base = timelines[selectedIndex] ? cloneTimeline(timelines[selectedIndex]) : createDefaultTimeline(timelines.length);
  base.id = createUniqueTimelineId(base.id, timelines);
  return base;
}

function createDuplicatedTimeline(
  timeline: WebKeyframesTimeline,
  timelines: WebKeyframesTimeline[],
): WebKeyframesTimeline {
  const duplicate = cloneTimeline(timeline);
  duplicate.id = createUniqueTimelineId(`${timeline.id}-copy`, timelines);
  return duplicate;
}

function createUniqueTimelineId(seed: string, timelines: WebKeyframesTimeline[]): string {
  const existing = new Set(timelines.map((timeline) => timeline.id));
  if (!existing.has(seed)) {
    return seed;
  }

  let index = 2;
  while (existing.has(`${seed}-${index}`)) {
    index += 1;
  }
  return `${seed}-${index}`;
}

function replaceTimelineState(target: WebKeyframesTimeline, source: WebKeyframesTimeline): void {
  target.id = source.id;
  target.duration = source.duration;
  target.translate = source.translate ? { ...source.translate } : undefined;
  target.keyframes = source.keyframes.map((keyframe) => ({
    time: keyframe.time,
    opacity: keyframe.opacity,
    transforms: Array.isArray(keyframe.transforms) ? keyframe.transforms.map(cloneTransform) : keyframe.transforms,
  }));
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return clampNumber(Number.isFinite(index) ? Math.round(index) : 0, 0, length - 1);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createNextKeyframe(
  keyframes: WebKeyframesTimeline["keyframes"],
  selectedIndex: number,
  duration: number,
): WebKeyframesTimeline["keyframes"][number] {
  const normalizedKeyframes = normalizeWebKeyframesTimeline({
    id: "preview",
    duration,
    keyframes,
  }).keyframes;
  const selected = normalizedKeyframes[selectedIndex] ?? normalizedKeyframes[normalizedKeyframes.length - 1];
  const next = normalizedKeyframes[selectedIndex + 1];
  const previous = normalizedKeyframes[selectedIndex - 1];
  let time = duration;

  if (selected && next) {
    time = Math.round((selected.time + next.time) / 2);
  } else if (selected && previous) {
    time = Math.min(duration, Math.round((selected.time + duration) / 2));
  } else if (selected) {
    time = Math.min(duration, selected.time);
  }

  return {
    time,
    opacity: selected?.opacity ?? 1,
    transforms: (selected?.transforms ?? [createDefaultTransform("translate")]).map(cloneTransform),
  };
}

function findClosestKeyframeIndex(
  keyframes: WebKeyframesTimeline["keyframes"],
  time: number,
  duration: number,
): number {
  const normalized = normalizeWebKeyframesTimeline({
    id: "preview",
    duration: Math.max(duration, 1),
    keyframes,
  }).keyframes;

  return normalized.reduce((closestIndex, keyframe, index) => {
    const currentDistance = Math.abs(normalized[closestIndex].time - time);
    const nextDistance = Math.abs(keyframe.time - time);
    return nextDistance < currentDistance ? index : closestIndex;
  }, 0);
}

function renderTextField(field: string, label: string, value: string): string {
  return `
    <label class="wkf__field">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <input class="wkf__input" type="text" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(value)}">
    </label>
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
): string {
  return `
    <label class="wkf__field">
      <span class="wkf__field-head">
        <span class="wkf__label">${escapeHtml(label)}</span>
        <button
          type="button"
          class="wkf__button wkf__button--tiny wkf__button--ghost"
          data-wkf-action="unset-${escapeHtml(field)}"
          ${value == null ? "disabled" : ""}
        >Unset</button>
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

function renderRangeField(field: string, label: string, value: number, min: number, max: number): string {
  return `
    <div class="wkf__field wkf__field--time">
      <span class="wkf__label">${escapeHtml(label)}</span>
      <div class="wkf__time-row">
        <input class="wkf__range" type="range" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="1">
        <input class="wkf__input" type="number" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(String(value))}" min="${min}" max="${max}" step="1">
      </div>
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
      return renderNumberField(`transform-value-${index}`, "Scale", transform.value, 0.001, 0.001);
    case "rotate":
      return renderNumberField(`transform-value-${index}`, "Rotate", transform.value, undefined, 0.1);
    case "skew":
      return `${renderNumberField(`transform-x-${index}`, "Skew X", transform.x, undefined, 0.1)}${renderNumberField(`transform-y-${index}`, "Skew Y", transform.y, undefined, 0.1)}`;
  }
}

function ensurePreviewStyleElement(ownerDocument: Document): HTMLStyleElement {
  const existing = ownerDocument.head.querySelector<HTMLStyleElement>("style[data-wkf-preview='true']");
  if (existing) {
    return existing;
  }

  const styleElement = ownerDocument.createElement("style");
  styleElement.dataset.wkfPreview = "true";
  ownerDocument.head.append(styleElement);
  return styleElement;
}

function findPreviewTargets(ownerDocument: Document, animationName: string): HTMLElement[] {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    return [];
  }

  return Array.from(ownerDocument.querySelectorAll<HTMLElement>("body *")).filter((element) => {
    const names = ownerWindow.getComputedStyle(element).animationName;
    return splitAnimationNames(names).includes(animationName);
  });
}

function splitAnimationNames(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "none");
}

function replaceAnimationName(value: string, currentName: string, nextName: string): string {
  const names = splitAnimationNames(value);
  if (names.length === 0) {
    return nextName;
  }

  return names.map((name) => (name === currentName ? nextName : name)).join(", ");
}

function formatTimelineSummary(timeline: RenderWebKeyframesTimeline): string {
  return `${timeline.keyframes.length} keyframes`;
}

function formatKeyframeSummary(
  keyframe: WebKeyframesTimeline["keyframes"][number] | NormalizedWebKeyframe,
  translate: RenderTranslateConfig,
): string {
  const parts: string[] = [];

  if (Array.isArray(keyframe.transforms)) {
    parts.push(
      keyframe.transforms.length > 0
        ? keyframe.transforms.map((transform) => formatTransformSummary(transform, translate)).join(" ")
        : "transform: none",
    );
  }

  if (typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity)) {
    parts.push(`opacity ${formatNumber(keyframe.opacity)}`);
  }

  return parts.join(", ");
}

function formatTransformSummary(transform: TransformOperation, translate: RenderTranslateConfig): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${formatSummaryTranslateValue(transform.x, translate)}, ${formatSummaryTranslateValue(transform.y, translate)})`;
    case "scale":
      return `scale(${formatNumber(transform.value)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function formatSummaryTranslateValue(value: number, translate: RenderTranslateConfig): string {
  const unit = translate.unit === "custom" ? translate.customUnit || "px" : translate.unit;
  return `${formatNumber(value)}${unit}`;
}

function formatPercentLabel(time: number, duration: number): string {
  const safeDuration = duration <= 0 ? 1 : duration;
  const percent = (time / safeDuration) * 100;
  return `${formatNumber(percent)}%`;
}

function isTranslateUnit(value: unknown): value is TranslateUnit {
  return value === "px" || value === "vw" || value === "vh" || value === "%" || value === "custom";
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
