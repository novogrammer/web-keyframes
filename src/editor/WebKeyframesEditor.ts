import {
  addTransform,
  cloneTransform,
  createDefaultTransform,
  DEFAULT_TRANSLATE_CONFIG,
  duplicateKeyframes,
  generatePreviewCss,
  generateScss,
  moveTransform,
  normalizeTransforms,
  normalizeWebKeyframesData,
  removeTransform,
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/index.js";
import type {
  NormalizedWebKeyframe,
  TransformKind,
  TransformOperation,
  TranslateUnit,
  WebKeyframesData,
} from "../core/index.js";

export type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesData;
  shortcut?: string | false;
};

export const DEFAULT_EDITOR_DATA: WebKeyframesData = {
  id: "new-animation",
  duration: 1200,
  translate: {
    unit: DEFAULT_TRANSLATE_CONFIG.unit,
    functionName: DEFAULT_TRANSLATE_CONFIG.functionName ?? undefined,
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

type ShortcutDescriptor = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

type RenderTranslateConfig = {
  unit: TranslateUnit;
  functionName: string;
  customUnit: string;
};

type RenderWebKeyframesData = Omit<WebKeyframesData, "translate" | "keyframes"> & {
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

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly shortcut: ShortcutDescriptor | null;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private readonly handleDragMove: (event: MouseEvent) => void;
  private readonly handleDragEnd: () => void;
  private container: HTMLElement | null = null;
  private mounted = false;
  private data: WebKeyframesData;
  private selectedKeyframeIndex = 0;
  private statusMessage = "Transform order is explicit. Preview and SCSS now use the same sequence.";
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
    this.data = normalizeForEditor(options.initialData ?? DEFAULT_EDITOR_DATA);
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

  getData(): WebKeyframesData {
    return cloneData(this.data);
  }

  setData(data: WebKeyframesData): void {
    this.data = normalizeForEditor(data);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.data.keyframes.length);
    if (this.container !== null) {
      this.render();
    }
  }

  toJson(): string {
    return JSON.stringify(normalizeWebKeyframesData(this.data), null, 2);
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

    const renderData = getRenderData(this.data);
    const selectedKeyframe = renderData.keyframes[this.selectedKeyframeIndex] ?? renderData.keyframes[0];
    this.selectedKeyframeIndex = renderData.keyframes.indexOf(selectedKeyframe);

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
          <div class="wkf__section">
            <div class="wkf__section-title">Timeline</div>
            <div class="wkf__grid wkf__grid--meta">
              ${renderTextField("id", "ID", renderData.id)}
              ${renderNumberField("duration", "Duration", renderData.duration, 1, 1)}
              ${renderSelectField("translateUnit", "Translate Unit", renderData.translate.unit, [
                { value: "px", label: "px" },
                { value: "vw", label: "vw" },
                { value: "vh", label: "vh" },
                { value: "%", label: "%" },
                { value: "custom", label: "custom" },
              ])}
              ${renderTextField("translateFunctionName", "Translate Function", renderData.translate.functionName ?? "")}
              ${
                renderData.translate.unit === "custom"
                  ? renderTextField("translateCustomUnit", "Custom Unit", renderData.translate.customUnit ?? "")
                  : ""
              }
            </div>
          </div>
          <div class="wkf__columns">
            <div class="wkf__section wkf__section--list">
              <div class="wkf__section-head">
                <div class="wkf__section-title">Keyframes</div>
                <div class="wkf__inline-actions wkf__inline-actions--wrap">
                  <button type="button" class="wkf__button wkf__button--small" data-wkf-action="add-keyframe">Add</button>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="duplicate-keyframe">Duplicate</button>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-keyframe" ${
                    renderData.keyframes.length <= 2 ? "disabled" : ""
                  }>Delete</button>
                </div>
              </div>
              <div class="wkf__keyframe-list">
                ${renderData.keyframes
                  .map(
                    (keyframe, index) => `
                      <button
                        type="button"
                        class="wkf__keyframe-item${index === this.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}"
                        data-wkf-action="select-keyframe"
                        data-wkf-index="${index}"
                      >
                        <span class="wkf__keyframe-time">${escapeHtml(String(keyframe.time))}ms</span>
                        <span class="wkf__keyframe-percent">${escapeHtml(formatPercentLabel(keyframe.time, renderData.duration))}</span>
                        <span class="wkf__keyframe-meta">${escapeHtml(formatKeyframeSummary(keyframe))}</span>
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
                  <p class="wkf__subtitle">${escapeHtml(formatPercentLabel(selectedKeyframe.time, renderData.duration))} of timeline</p>
                </div>
              </div>
              <div class="wkf__grid wkf__grid--editor">
                ${renderRangeField("time", "Time", selectedKeyframe.time, 0, renderData.duration)}
                ${renderNumberField("opacity", "Opacity", selectedKeyframe.opacity, 0, 0.01, 1)}
              </div>
              <div class="wkf__section-head">
                <div class="wkf__section-title">Transforms</div>
                <div class="wkf__inline-actions">
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="translate">+ Translate</button>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="scale">+ Scale</button>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="rotate">+ Rotate</button>
                  <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="add-transform" data-wkf-kind="skew">+ Skew</button>
                </div>
              </div>
              <div class="wkf__transform-list">
                ${selectedKeyframe.transforms.map((transform, index) => renderTransformEditor(transform, index, selectedKeyframe.transforms.length)).join("")}
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
        <div class="wkf__footer">
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
    this.bindMetaFields();
    this.bindKeyframeSelection();
    this.bindKeyframeEditor();
    this.bindTransformEditor(selectedKeyframe);
    this.bindKeyframeActions();
    this.bindCopyActions();
    this.bindPreviewActions();
    this.applyPanelPosition();
    queueMicrotask(() => this.restoreFocus());
  }

  private bindDragging(): void {
    const handle = this.container?.querySelector<HTMLElement>("[data-wkf-drag-handle='true']");
    if (!handle) {
      return;
    }

    handle.addEventListener("mousedown", (event) => this.startDragging(event));
  }

  private bindMetaFields(): void {
    this.bindInputValue("id", (value) => {
      this.data.id = value;
    });
    this.bindInputValue("translateFunctionName", (value) => {
      this.data.translate = {
        ...(this.data.translate ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
        functionName: value,
      };
    });
    this.bindInputValue("translateCustomUnit", (value) => {
      this.data.translate = {
        ...(this.data.translate ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
        customUnit: value,
      };
    });
    this.bindInputValue("translateUnit", (value) => {
      this.data.translate = {
        ...(this.data.translate ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
        unit: value as TranslateUnit,
      };
    });
    this.bindInputNumber("duration", (value) => {
      this.data.duration = Math.max(1, Math.round(value));
      this.data.keyframes = this.data.keyframes.map((keyframe) => ({
        ...keyframe,
        time: Math.min(keyframe.time, this.data.duration),
      }));
      this.data = normalizeForEditor(this.data);
    });
  }

  private bindKeyframeSelection(): void {
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='select-keyframe']").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedKeyframeIndex = clampIndex(Number(button.dataset.wkfIndex ?? "0"), this.data.keyframes.length);
        this.render();
      });
    });
  }

  private bindKeyframeEditor(): void {
    this.bindInputNumber("time", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.time = clampNumber(Math.round(value), 0, this.data.duration);
      });
    });
    this.bindInputNumber("opacity", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.opacity = clampNumber(value, 0, 1);
      });
    });
  }

  private bindTransformEditor(selectedKeyframe: NormalizedWebKeyframe): void {
    selectedKeyframe.transforms.forEach((transform, index) => {
      this.bindInputValue(`transform-kind-${index}`, (value) => {
        this.data = normalizeForEditor(replaceTransformKind(this.data, this.selectedKeyframeIndex, index, value as TransformKind));
      });

      switch (transform.kind) {
        case "translate":
          this.bindInputNumber(`transform-x-${index}`, (value) => {
            this.data = normalizeForEditor(setTransformFieldValue(this.data, this.selectedKeyframeIndex, index, "x", value));
          });
          this.bindInputNumber(`transform-y-${index}`, (value) => {
            this.data = normalizeForEditor(setTransformFieldValue(this.data, this.selectedKeyframeIndex, index, "y", value));
          });
          break;
        case "scale":
        case "rotate":
          this.bindInputNumber(`transform-value-${index}`, (value) => {
            this.data = normalizeForEditor(setTransformFieldValue(this.data, this.selectedKeyframeIndex, index, "value", value));
          });
          break;
        case "skew":
          this.bindInputNumber(`transform-x-${index}`, (value) => {
            this.data = normalizeForEditor(setTransformFieldValue(this.data, this.selectedKeyframeIndex, index, "x", value));
          });
          this.bindInputNumber(`transform-y-${index}`, (value) => {
            this.data = normalizeForEditor(setTransformFieldValue(this.data, this.selectedKeyframeIndex, index, "y", value));
          });
          break;
      }
    });

    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='move-transform-up']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.data = normalizeForEditor(moveTransform(this.data, this.selectedKeyframeIndex, index, -1));
        this.setStatus("info", "Reordered transforms.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='move-transform-down']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.data = normalizeForEditor(moveTransform(this.data, this.selectedKeyframeIndex, index, 1));
        this.setStatus("info", "Reordered transforms.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='delete-transform']").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.wkfIndex ?? "0");
        this.data = normalizeForEditor(removeTransform(this.data, this.selectedKeyframeIndex, index));
        this.setStatus("info", "Removed transform.");
        this.render();
      });
    });
    this.container?.querySelectorAll<HTMLElement>("[data-wkf-action='add-transform']").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = (button.dataset.wkfKind ?? "translate") as TransformKind;
        this.data = normalizeForEditor(addTransform(this.data, this.selectedKeyframeIndex, kind));
        this.setStatus("info", `Added ${kind} transform.`);
        this.render();
      });
    });
  }

  private bindKeyframeActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='add-keyframe']")?.addEventListener("click", () => {
      const nextFrame = createNextKeyframe(this.data.keyframes, this.selectedKeyframeIndex, this.data.duration);
      this.data = normalizeForEditor({
        ...this.data,
        keyframes: [...this.data.keyframes, nextFrame],
      });
      this.selectedKeyframeIndex = findClosestKeyframeIndex(this.data.keyframes, nextFrame.time);
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='delete-keyframe']")?.addEventListener("click", () => {
      if (this.data.keyframes.length <= 2) {
        return;
      }

      this.data = normalizeForEditor({
        ...this.data,
        keyframes: this.data.keyframes.filter((_, index) => index !== this.selectedKeyframeIndex),
      });
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.data.keyframes.length);
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='duplicate-keyframe']")?.addEventListener("click", () => {
      this.data = normalizeForEditor(duplicateKeyframes(this.data, [this.selectedKeyframeIndex]));
      const targetTime = Math.min(
        this.data.duration,
        (this.data.keyframes[this.selectedKeyframeIndex]?.time ?? 0) + Math.max(1, Math.round(this.data.duration * 0.1)),
      );
      this.selectedKeyframeIndex = findClosestKeyframeIndex(this.data.keyframes, targetTime);
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

  private bindInputNumber(field: string, assign: (value: number) => void): void {
    this.container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`).forEach((input) => {
      const eventName = input.type === "range" ? "input" : "change";
      input.addEventListener(eventName, () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
          return;
        }

        this.pendingFocus = captureFocusSnapshot(this.container, field, input);
        assign(value);
        this.setStatus("info", "Editing timeline data.");
        this.render();
      });
    });
  }

  private updateSelectedKeyframe(update: (keyframe: NormalizedWebKeyframe) => void): void {
    const keyframes = normalizeWebKeyframesData(this.data).keyframes.map((keyframe) => ({
      ...keyframe,
      transforms: keyframe.transforms.map(cloneTransform),
    }));
    const selected = keyframes[this.selectedKeyframeIndex];
    if (!selected) {
      return;
    }

    update(selected);
    keyframes.sort((left, right) => left.time - right.time);
    this.selectedKeyframeIndex = keyframes.indexOf(selected);
    this.data = normalizeForEditor({
      ...this.data,
      keyframes,
    });
    this.setStatus("info", "Editing timeline data.");
    this.render();
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
    this.data = normalizeForEditor(DEFAULT_EDITOR_DATA);
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
      const normalized = normalizeWebKeyframesData(this.data);
      const ownerDocument = this.root.ownerDocument;
      const ownerWindow = ownerDocument.defaultView;
      if (!ownerWindow) {
        throw new Error("Preview is not available in this environment.");
      }

      this.clearAppliedPreview();

      const targets = findPreviewTargets(ownerDocument, normalized.id);
      if (targets.length === 0) {
        throw new Error(`No elements using animation-name "${normalized.id}" were found.`);
      }

      const previewName = `${normalized.id}__wkf_preview`;
      const styleElement = ensurePreviewStyleElement(ownerDocument);
      styleElement.textContent = generatePreviewCss(this.data, previewName);

      const appliedTargets = targets.map((element) => ({
        element,
        inlineAnimationName: element.style.animationName,
      }));

      for (const target of appliedTargets) {
        const computedAnimationName = ownerWindow.getComputedStyle(target.element).animationName;
        const nextAnimationName = replaceAnimationName(computedAnimationName, normalized.id, previewName);
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
        `Applied preview to ${appliedTargets.length} element${appliedTargets.length === 1 ? "" : "s"} with the current transform order.`,
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
    const maxLeft = Math.max(0, ownerWindow.innerWidth - rect.width);
    const maxTop = Math.max(0, ownerWindow.innerHeight - rect.height);
    this.panelPosition = {
      left: clampNumber(event.clientX - this.dragState.pointerOffsetX, 0, maxLeft),
      top: clampNumber(event.clientY - this.dragState.pointerOffsetY, 0, maxTop),
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

function cloneData(data: WebKeyframesData | ReturnType<typeof normalizeWebKeyframesData>): WebKeyframesData {
  return sanitizeEditorData(data);
}

function normalizeForEditor(data: WebKeyframesData | ReturnType<typeof normalizeWebKeyframesData>): WebKeyframesData {
  return cloneData(data);
}

function getRenderData(data: WebKeyframesData): RenderWebKeyframesData {
  const normalized = sanitizeEditorData(data);
  return {
    ...normalized,
    duration: Number.isFinite(normalized.duration) && normalized.duration > 0 ? Math.round(normalized.duration) : 1,
    translate: {
      unit: normalized.translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: normalized.translate?.functionName?.trim() || "",
      customUnit: normalized.translate?.unit === "custom" ? normalized.translate.customUnit?.trim() || "" : "",
    },
    keyframes: normalized.keyframes.map((keyframe) => ({
      ...keyframe,
      transforms: normalizeTransforms(keyframe).map(cloneTransform),
    })),
  };
}

function sanitizeEditorData(data: WebKeyframesData | ReturnType<typeof normalizeWebKeyframesData>): WebKeyframesData {
  const candidate = data as Partial<WebKeyframesData>;
  const keyframes = Array.isArray(candidate.keyframes) && candidate.keyframes.length > 0
    ? candidate.keyframes
    : DEFAULT_EDITOR_DATA.keyframes;

  return {
    id: typeof candidate.id === "string" ? candidate.id : DEFAULT_EDITOR_DATA.id,
    duration: typeof candidate.duration === "number" && Number.isFinite(candidate.duration) && candidate.duration > 0
      ? Math.round(candidate.duration)
      : DEFAULT_EDITOR_DATA.duration,
    translate: {
      unit: isTranslateUnit(candidate.translate?.unit) ? candidate.translate.unit : DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: typeof candidate.translate?.functionName === "string" ? candidate.translate.functionName : undefined,
      customUnit: typeof candidate.translate?.customUnit === "string" ? candidate.translate.customUnit : undefined,
    },
    keyframes: keyframes
      .map((keyframe) => ({
        time: typeof keyframe.time === "number" && Number.isFinite(keyframe.time) ? keyframe.time : 0,
        opacity: typeof keyframe.opacity === "number" && Number.isFinite(keyframe.opacity) ? keyframe.opacity : 1,
        transforms: normalizeTransforms(keyframe).map(cloneTransform),
      }))
      .sort((left, right) => left.time - right.time),
  };
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
  keyframes: WebKeyframesData["keyframes"],
  selectedIndex: number,
  duration: number,
): WebKeyframesData["keyframes"][number] {
  const normalizedKeyframes = normalizeWebKeyframesData({
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
  keyframes: WebKeyframesData["keyframes"],
  time: number,
): number {
  const normalized = normalizeWebKeyframesData({
    id: "preview",
    duration: Math.max(1, ...keyframes.map((keyframe) => keyframe.time)),
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
          <button type="button" class="wkf__button wkf__button--small wkf__button--ghost" data-wkf-action="delete-transform" data-wkf-index="${index}" ${total <= 1 ? "disabled" : ""}>Delete</button>
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

function formatKeyframeSummary(keyframe: NormalizedWebKeyframe): string {
  return `${keyframe.transforms.map(formatTransformSummary).join(" | ")}, opacity ${formatNumber(keyframe.opacity)}`;
}

function formatTransformSummary(transform: TransformOperation): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
    case "scale":
      return `scale(${formatNumber(transform.value)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)})`;
    case "skew":
      return `skew(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
  }
}

function formatPercentLabel(time: number, duration: number): string {
  const safeDuration = duration <= 0 ? 1 : duration;
  const percent = (time / safeDuration) * 100;
  return `${formatNumber(percent)}%`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
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
