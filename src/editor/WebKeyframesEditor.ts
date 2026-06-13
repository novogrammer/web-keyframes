import {
  DEFAULT_TRANSLATE_CONFIG,
  generateScss,
  normalizeWebKeyframesData,
  validateWebKeyframesData,
} from "../core/index.js";
import type { TranslateUnit, WebKeyframesData } from "../core/index.js";

export type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesData;
  shortcut?: string | false;
};

export const DEFAULT_EDITOR_DATA: WebKeyframesData = {
  id: "new-animation",
  target: ".js-target",
  duration: 1200,
  designWidth: 1440,
  translate: {
    unit: DEFAULT_TRANSLATE_CONFIG.unit,
    functionName: DEFAULT_TRANSLATE_CONFIG.functionName ?? undefined,
  },
  keyframes: [
    { time: 0, x: 0, y: 40, scale: 1, rotate: 0, opacity: 0 },
    { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
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

type RenderWebKeyframesData = Omit<WebKeyframesData, "translate"> & {
  translate: RenderTranslateConfig;
};

type FocusSnapshot = {
  field: string;
  index: number;
  selectionStart: number | null;
  selectionEnd: number | null;
};

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly shortcut: ShortcutDescriptor | null;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private container: HTMLElement | null = null;
  private mounted = false;
  private data: WebKeyframesData;
  private selectedKeyframeIndex = 0;
  private statusMessage = "Core data updates are live. Copy actions and richer timeline controls are next.";
  private statusTone: "info" | "success" | "error" = "info";
  private previewTitle: string | null = null;
  private previewContent = "";
  private pendingFocus: FocusSnapshot | null = null;

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
  }

  mount(): void {
    if (this.mounted) {
      throw new Error("mount() has already been called.");
    }

    const ownerDocument = this.root.ownerDocument;
    const container = ownerDocument.createElement("section");
    container.className = "__wkf-root";
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

    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
    this.container?.remove();
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    this.container!.classList.add("__wkf-root--visible");
    this.container!.setAttribute("aria-hidden", "false");
  }

  hide(): void {
    this.ensureMounted();
    this.container!.classList.remove("__wkf-root--visible");
    this.container!.setAttribute("aria-hidden", "true");
  }

  toggle(): void {
    this.ensureMounted();
    if (this.container!.classList.contains("__wkf-root--visible")) {
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
      <div class="__wkf-panel">
        <div class="__wkf-header">
          <div>
            <p class="__wkf-kicker">web-keyframes editor</p>
            <h2 class="__wkf-title">Keyframe Data Editor</h2>
          </div>
          <div class="__wkf-actions">
            <button type="button" class="__wkf-button __wkf-button--ghost" data-wkf-action="reset">Reset</button>
            <button type="button" class="__wkf-button __wkf-button--ghost" data-wkf-action="hide">Hide</button>
          </div>
        </div>
        <div class="__wkf-layout">
          <div class="__wkf-section">
            <div class="__wkf-section-title">Timeline</div>
            <div class="__wkf-grid __wkf-grid--meta">
              ${renderTextField("id", "ID", renderData.id)}
              ${renderTextField("target", "Target Selector", renderData.target)}
              ${renderNumberField("duration", "Duration", renderData.duration, 1, 1)}
              ${renderNumberField("designWidth", "Design Width", renderData.designWidth, 1, 1)}
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
          <div class="__wkf-columns">
            <div class="__wkf-section __wkf-section--list">
              <div class="__wkf-section-head">
                <div class="__wkf-section-title">Keyframes</div>
                <div class="__wkf-inline-actions">
                  <button type="button" class="__wkf-button __wkf-button--small" data-wkf-action="add-keyframe">Add</button>
                  <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="duplicate-keyframe">Duplicate</button>
                  <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="delete-keyframe" ${
                    renderData.keyframes.length <= 2 ? "disabled" : ""
                  }>Delete</button>
                </div>
              </div>
              <div class="__wkf-keyframe-list">
                ${renderData.keyframes
                  .map(
                    (keyframe, index) => `
                      <button
                        type="button"
                        class="__wkf-keyframe-item${index === this.selectedKeyframeIndex ? " __wkf-keyframe-item--active" : ""}"
                        data-wkf-action="select-keyframe"
                        data-wkf-index="${index}"
                      >
                        <span class="__wkf-keyframe-time">${escapeHtml(String(keyframe.time))}ms</span>
                        <span class="__wkf-keyframe-percent">${escapeHtml(formatPercentLabel(keyframe.time, renderData.duration))}</span>
                        <span class="__wkf-keyframe-meta">${escapeHtml(formatKeyframeSummary(keyframe))}</span>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            </div>
            <div class="__wkf-section __wkf-section--editor">
              <div class="__wkf-section-head">
                <div>
                  <div class="__wkf-section-title">Selected Keyframe</div>
                  <p class="__wkf-subtitle">${escapeHtml(formatPercentLabel(selectedKeyframe.time, renderData.duration))} of timeline</p>
                </div>
              </div>
              <div class="__wkf-grid __wkf-grid--editor">
                ${renderRangeField("time", "Time", selectedKeyframe.time, 0, renderData.duration)}
                ${renderNumberField("x", "X", selectedKeyframe.x)}
                ${renderNumberField("y", "Y", selectedKeyframe.y)}
                ${renderNumberField("scale", "Scale", selectedKeyframe.scale, 0.001, 0.001)}
                ${renderNumberField("rotate", "Rotate", selectedKeyframe.rotate, 1, 0.1)}
                ${renderNumberField("opacity", "Opacity", selectedKeyframe.opacity, 0, 0.01, 1)}
              </div>
            </div>
          </div>
        </div>
        ${
          this.previewTitle !== null
            ? `
              <div class="__wkf-preview">
                <div class="__wkf-preview-head">
                  <div>
                    <div class="__wkf-section-title">${escapeHtml(this.previewTitle)}</div>
                    <p class="__wkf-subtitle">Current generated output</p>
                  </div>
                  <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="close-preview">Close</button>
                </div>
                <textarea class="__wkf-preview-textarea" readonly>${escapeHtml(this.previewContent)}</textarea>
              </div>
            `
            : ""
        }
        <div class="__wkf-footer">
          <p class="__wkf-note __wkf-note--${this.statusTone}" data-wkf-status>${escapeHtml(this.statusMessage)}</p>
          <div class="__wkf-inline-actions">
            <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="view-json">View JSON</button>
            <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="view-scss">View SCSS</button>
            <button type="button" class="__wkf-button __wkf-button--small __wkf-button--ghost" data-wkf-action="copy-json">Copy JSON</button>
            <button type="button" class="__wkf-button __wkf-button--small" data-wkf-action="copy-scss">Copy SCSS</button>
          </div>
        </div>
      </div>
    `;

    const hideButton = this.container.querySelector<HTMLElement>("[data-wkf-action='hide']");
    hideButton?.addEventListener("click", () => {
      this.hide();
    });
    this.container.querySelector<HTMLElement>("[data-wkf-action='reset']")?.addEventListener("click", () => {
      this.reset();
    });

    this.bindMetaFields();
    this.bindKeyframeSelection();
    this.bindKeyframeEditor();
    this.bindKeyframeActions();
    this.bindCopyActions();
    this.bindPreviewActions();
    queueMicrotask(() => {
      this.restoreFocus();
    });
  }

  private bindMetaFields(): void {
    this.bindInputValue("id", (value) => {
      this.data.id = value;
    });
    this.bindInputValue("target", (value) => {
      this.data.target = value;
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
    this.bindInputNumber("designWidth", (value) => {
      this.data.designWidth = Math.max(1, Math.round(value));
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
    this.bindInputNumber("x", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.x = value;
      });
    });
    this.bindInputNumber("y", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.y = value;
      });
    });
    this.bindInputNumber("scale", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.scale = value;
      });
    });
    this.bindInputNumber("rotate", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.rotate = value;
      });
    });
    this.bindInputNumber("opacity", (value) => {
      this.updateSelectedKeyframe((keyframe) => {
        keyframe.opacity = clampNumber(value, 0, 1);
      });
    });
  }

  private bindKeyframeActions(): void {
    this.container?.querySelector<HTMLElement>("[data-wkf-action='add-keyframe']")?.addEventListener("click", () => {
      const nextFrame = createNextKeyframe(this.data.keyframes, this.selectedKeyframeIndex, this.data.duration);
      const nextKeyframes = [...this.data.keyframes, nextFrame];
      this.data = {
        ...this.data,
        keyframes: nextKeyframes,
      };
      this.data = normalizeForEditor(this.data);
      this.selectedKeyframeIndex = this.data.keyframes.findIndex((keyframe) => keyframe === nextFrame);
      if (this.selectedKeyframeIndex === -1) {
        this.selectedKeyframeIndex = findClosestKeyframeIndex(this.data.keyframes, nextFrame.time);
      }
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='delete-keyframe']")?.addEventListener("click", () => {
      if (this.data.keyframes.length <= 2) {
        return;
      }

      this.data = {
        ...this.data,
        keyframes: this.data.keyframes.filter((_, index) => index !== this.selectedKeyframeIndex),
      };
      this.data = normalizeForEditor(this.data);
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.data.keyframes.length);
      this.render();
    });

    this.container?.querySelector<HTMLElement>("[data-wkf-action='duplicate-keyframe']")?.addEventListener("click", () => {
      const duplicatedFrame = duplicateKeyframe(this.data.keyframes, this.selectedKeyframeIndex, this.data.duration);
      this.data = {
        ...this.data,
        keyframes: [...this.data.keyframes, duplicatedFrame],
      };
      this.data = normalizeForEditor(this.data);
      this.selectedKeyframeIndex = findClosestKeyframeIndex(this.data.keyframes, duplicatedFrame.time, duplicatedFrame);
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

  private updateSelectedKeyframe(update: (keyframe: NonNullable<WebKeyframesData["keyframes"][number]>) => void): void {
    const keyframes = this.data.keyframes.map((keyframe) => ({ ...keyframe }));
    const selected = keyframes[this.selectedKeyframeIndex];
    if (!selected) {
      return;
    }

    update(selected);
    keyframes.sort((left, right) => left.time - right.time);
    this.selectedKeyframeIndex = keyframes.indexOf(selected);
    this.data = {
      ...this.data,
      keyframes,
    };
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

function cloneData(data: WebKeyframesData): WebKeyframesData {
  return {
    ...data,
    translate: data.translate ? { ...data.translate } : undefined,
    keyframes: data.keyframes.map((keyframe) => ({ ...keyframe })),
  };
}

function normalizeForEditor(data: WebKeyframesData): WebKeyframesData {
  const normalized = normalizeWebKeyframesData(cloneData(validateWebKeyframesData(data)));
  return {
    ...normalized,
    translate: {
      unit: normalized.translate.unit,
      functionName: normalized.translate.functionName ?? undefined,
      customUnit: normalized.translate.customUnit ?? undefined,
    },
    keyframes: normalized.keyframes.map((keyframe) => ({ ...keyframe })),
  };
}

function getRenderData(data: WebKeyframesData): RenderWebKeyframesData {
  const cloned = cloneData(data);
  return {
    ...cloned,
    duration: Number.isFinite(cloned.duration) && cloned.duration > 0 ? Math.round(cloned.duration) : 1,
    designWidth: Number.isFinite(cloned.designWidth) ? cloned.designWidth : 1440,
    translate: {
      unit: cloned.translate?.unit ?? DEFAULT_TRANSLATE_CONFIG.unit,
      functionName: cloned.translate?.functionName?.trim() || "",
      customUnit: cloned.translate?.unit === "custom" ? cloned.translate.customUnit?.trim() || "" : "",
    },
    keyframes: cloned.keyframes
      .map((keyframe) => ({
        ...keyframe,
        time: Number.isFinite(keyframe.time) ? keyframe.time : 0,
        x: Number.isFinite(keyframe.x) ? keyframe.x : 0,
        y: Number.isFinite(keyframe.y) ? keyframe.y : 0,
        scale: Number.isFinite(keyframe.scale) ? keyframe.scale : 1,
        rotate: Number.isFinite(keyframe.rotate) ? keyframe.rotate : 0,
        opacity: Number.isFinite(keyframe.opacity) ? keyframe.opacity : 1,
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
) {
  const selected = keyframes[selectedIndex] ?? keyframes[keyframes.length - 1];
  const next = keyframes[selectedIndex + 1];
  const previous = keyframes[selectedIndex - 1];
  let time = duration;

  if (selected && next) {
    time = Math.round((selected.time + next.time) / 2);
  } else if (selected && previous) {
    time = Math.min(duration, Math.round((selected.time + duration) / 2));
  } else if (selected) {
    time = Math.min(duration, selected.time);
  }

  return {
    ...selected,
    time,
  };
}

function findClosestKeyframeIndex(
  keyframes: WebKeyframesData["keyframes"],
  time: number,
  preferredFrame?: WebKeyframesData["keyframes"][number],
): number {
  if (preferredFrame) {
    const exactIndex = keyframes.indexOf(preferredFrame);
    if (exactIndex !== -1) {
      return exactIndex;
    }
  }

  return keyframes.reduce((closestIndex, keyframe, index) => {
    const currentDistance = Math.abs(keyframes[closestIndex].time - time);
    const nextDistance = Math.abs(keyframe.time - time);
    return nextDistance < currentDistance ? index : closestIndex;
  }, 0);
}

function duplicateKeyframe(
  keyframes: WebKeyframesData["keyframes"],
  selectedIndex: number,
  duration: number,
) {
  const selected = keyframes[selectedIndex] ?? keyframes[keyframes.length - 1];
  const next = keyframes[selectedIndex + 1];
  const nextTime = next ? Math.round((selected.time + next.time) / 2) : Math.min(duration, selected.time + Math.max(1, Math.round(duration * 0.1)));

  return {
    ...selected,
    time: clampNumber(nextTime, 0, duration),
  };
}

function renderTextField(field: string, label: string, value: string): string {
  return `
    <label class="__wkf-field">
      <span class="__wkf-label">${escapeHtml(label)}</span>
      <input class="__wkf-input" type="text" data-wkf-field="${escapeHtml(field)}" value="${escapeHtml(value)}">
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
    <label class="__wkf-field">
      <span class="__wkf-label">${escapeHtml(label)}</span>
      <select class="__wkf-input" data-wkf-field="${escapeHtml(field)}">
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
    <label class="__wkf-field">
      <span class="__wkf-label">${escapeHtml(label)}</span>
      <input
        class="__wkf-input"
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
    <div class="__wkf-field __wkf-field--time">
      <span class="__wkf-label">${escapeHtml(label)}</span>
      <div class="__wkf-time-row">
        <input
          class="__wkf-range"
          type="range"
          data-wkf-field="${escapeHtml(field)}"
          value="${escapeHtml(String(value))}"
          min="${min}"
          max="${max}"
          step="1"
        >
        <input
          class="__wkf-input"
          type="number"
          data-wkf-field="${escapeHtml(field)}"
          value="${escapeHtml(String(value))}"
          min="${min}"
          max="${max}"
          step="1"
        >
      </div>
    </div>
  `;
}

function formatKeyframeSummary(keyframe: WebKeyframesData["keyframes"][number]): string {
  return `x ${keyframe.x}, y ${keyframe.y}, opacity ${keyframe.opacity}`;
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
