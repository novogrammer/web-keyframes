import {
  addTransform,
  moveTransform,
  removeTransform,
  replaceTransformKind,
  setTransformFieldValue,
} from "../core/edit.js";
import { generateCss } from "../core/generateCss.js";
import {
  cloneDocument,
  cloneTimeline,
  createOpacityProperty,
  createDefaultTransform,
  createTransformProperty,
  DEFAULT_TRANSLATE_CONFIG,
  deleteKeyframeProperty,
  getTimelinePositionType,
  hasKeyframeProperty,
  normalizeWebKeyframesTimeline,
  upsertKeyframeProperty,
} from "../core/normalize.js";
import type {
  TransformKind,
  TranslateUnit,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/types.js";
import {
  applyEditorKeyframePosition,
  clampIndex,
  clampNumber,
  cloneSparseKeyframe,
  createDuplicatedTimeline,
  createNextKeyframe,
  createNextTimeline,
  deriveEditorRenderState,
  getEditorKeyframePosition,
  roundEditorPosition,
  sanitizeEditorDocument,
} from "./editorModel.js";
import {
  applyPanelPosition,
  beginPanelDrag,
  captureFocusSnapshot,
  type FocusSnapshot,
  finishPanelDrag,
  restoreFocusSnapshot,
  syncNumberFieldValues,
  updatePanelDrag,
} from "./editorInteraction.js";
import { renderEditorPanel } from "./editorView.js";

type WebKeyframesEditorOptions = {
  root: HTMLElement | ShadowRoot;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
  onDataChange?: (data: WebKeyframesDocument) => void;
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

const DEFAULT_EDITOR_DATA: WebKeyframesDocument = {
  timelines: [cloneTimeline(DEFAULT_TIMELINE_DATA)],
};

type ShortcutDescriptor = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
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
  styleElement: HTMLStyleElement;
  targets: PreviewTargetState[];
};

export class WebKeyframesEditor {
  private readonly root: HTMLElement | ShadowRoot;
  private shortcut: ShortcutDescriptor | null;
  private readonly initialData: WebKeyframesDocument;
  private readonly onDataChange: ((data: WebKeyframesDocument) => void) | null;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
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
  private lastNotifiedDataJson: string;

  constructor(options: WebKeyframesEditorOptions) {
    if (!isEditorMountRoot(options.root)) {
      throw new Error("root must be an HTMLElement or ShadowRoot.");
    }

    this.root = options.root;
    this.initialData = sanitizeEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA, DEFAULT_TIMELINE_DATA);
    this.data = cloneDocument(this.initialData);
    this.shortcut = parseShortcut(options.shortcut);
    this.onDataChange = options.onDataChange ?? null;
    this.lastNotifiedDataJson = JSON.stringify(this.data);
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
    this.handleContainerClick = (event) => {
      this.handleDelegatedClick(event);
    };
    this.handleContainerInput = (event) => {
      this.handleDelegatedInput(event);
    };
    this.handleContainerChange = (event) => {
      this.handleDelegatedChange(event);
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

  setShortcut(shortcut: string | false | undefined): void {
    this.shortcut = parseShortcut(shortcut);
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.data);
  }

  setData(data: WebKeyframesDocument): void {
    this.data = sanitizeEditorDocument(data, DEFAULT_TIMELINE_DATA);
    this.normalizeEditorState();
    this.notifyDataChangeIfNeeded();
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
    this.selectedTimelineIndex = renderState.selectedTimelineIndex;
    this.selectedKeyframeIndex = renderState.selectedKeyframeIndex;

    this.container.replaceChildren(renderEditorPanel(
      this.root.ownerDocument,
      renderState,
      {
        previewContent: this.previewContent,
        previewTitle: this.previewTitle,
        selectedKeyframeIndex: this.selectedKeyframeIndex,
        selectedTimelineIndex: this.selectedTimelineIndex,
        statusMessage: this.statusMessage,
        statusTone: this.statusTone,
      },
    ));
    this.bindDragging();
    this.applyPanelPosition();
    this.notifyDataChangeIfNeeded();
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

  private handleDelegatedClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || this.container === null) {
      return;
    }

    const actionTarget = target.closest<HTMLElement>("[data-wkf-action]");
    if (!actionTarget || !this.container.contains(actionTarget) || actionTarget.hasAttribute("disabled")) {
      return;
    }

    const action = actionTarget.dataset.wkfAction;
    if (!action) {
      return;
    }

    if (this.handleEditorChromeAction(action)) {
      return;
    }
    if (this.handleTimelineAction(action, actionTarget)) {
      return;
    }
    if (this.handleKeyframeAction(action, actionTarget)) {
      return;
    }
    this.handlePreviewAction(action);
  }

  private handleEditorChromeAction(action: string): boolean {
    switch (action) {
      case "hide":
        this.hide();
        return true;
      case "reset":
        this.reset();
        return true;
      default:
        return false;
    }
  }

  private handleTimelineAction(action: string, actionTarget: HTMLElement): boolean {
    switch (action) {
      case "select-timeline":
        this.selectedTimelineIndex = clampIndex(Number(actionTarget.dataset.wkfIndex ?? "0"), this.data.timelines.length);
        this.normalizeEditorState();
        this.render();
        return true;
      case "add-timeline":
        this.addTimeline();
        return true;
      case "duplicate-timeline":
        this.duplicateTimeline();
        return true;
      case "delete-timeline":
        this.deleteTimeline();
        return true;
      default:
        return false;
    }
  }

  private handleKeyframeAction(action: string, actionTarget: HTMLElement): boolean {
    switch (action) {
      case "select-keyframe":
        this.selectedKeyframeIndex = clampIndex(Number(actionTarget.dataset.wkfIndex ?? "0"), this.getSelectedTimeline().keyframes.length);
        this.render();
        return true;
      case "set-timing-function":
        this.setTimingFunctionPreset(actionTarget.dataset.wkfValue ?? "");
        return true;
      case "clear-timing-function":
        this.clearTimingFunction();
        return true;
      case "move-transform-up":
        this.moveSelectedTransform(Number(actionTarget.dataset.wkfIndex ?? "0"), -1);
        return true;
      case "move-transform-down":
        this.moveSelectedTransform(Number(actionTarget.dataset.wkfIndex ?? "0"), 1);
        return true;
      case "delete-transform":
        this.deleteSelectedTransform(Number(actionTarget.dataset.wkfIndex ?? "0"));
        return true;
      case "add-transform":
        this.addSelectedTransform((actionTarget.dataset.wkfKind ?? "translate") as TransformKind);
        return true;
      case "add-opacity":
        this.addOpacityProperty();
        return true;
      case "delete-opacity":
        this.deleteOpacityProperty();
        return true;
      case "delete-transforms":
        this.deleteTransformProperty();
        return true;
      case "clear-transforms":
        this.clearTransformProperty();
        return true;
      case "add-keyframe":
        this.addKeyframe();
        return true;
      case "delete-keyframe":
        this.deleteKeyframe();
        return true;
      case "duplicate-keyframe":
        this.duplicateKeyframe();
        return true;
      default:
        return false;
    }
  }

  private handlePreviewAction(action: string): void {
    switch (action) {
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
        this.openGeneratedPreview("json");
        return;
      case "view-css":
        this.openGeneratedPreview("css");
        return;
      case "close-preview":
        this.closePreview("Closed preview.");
        return;
      default:
        return;
    }
  }

  private handleDelegatedInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.wkfField) {
      return;
    }

    this.handleFieldUpdate(target.dataset.wkfField, target, "input");
  }

  private handleDelegatedChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement) || !target.dataset.wkfField) {
      return;
    }

    this.handleFieldUpdate(target.dataset.wkfField, target, "change");
  }

  private handleFieldUpdate(
    field: string,
    input: HTMLInputElement | HTMLSelectElement,
    eventType: "input" | "change",
  ): void {
    if (input instanceof HTMLSelectElement) {
      if (eventType === "change") {
        this.applyTextFieldChange(field, input);
      }
      return;
    }

    if (input.type === "range") {
      if (eventType === "input") {
        this.applyRangeFieldInput(field, input);
        return;
      }

      this.applyNumericFieldChange(field, input);
      return;
    }

    if (input.type === "number") {
      if (eventType === "change") {
        this.applyNumericFieldChange(field, input);
      }
      return;
    }

    if (eventType === "input") {
      this.applyTextFieldChange(field, input);
    }
  }

  private addTimeline(): void {
      const nextTimeline = createNextTimeline(this.data.timelines, this.selectedTimelineIndex, DEFAULT_TIMELINE_DATA);
      this.data = sanitizeEditorDocument({
        timelines: [...this.data.timelines, nextTimeline],
      }, DEFAULT_TIMELINE_DATA);
      this.selectedTimelineIndex = this.data.timelines.findIndex((timeline) => timeline.id === nextTimeline.id);
      this.selectedKeyframeIndex = 0;
      this.renderWithStatus("info", "Added timeline.");
  }

  private duplicateTimeline(): void {
      const source = this.getSelectedTimeline();
      const duplicate = createDuplicatedTimeline(source, this.data.timelines);
      const timelines = this.data.timelines.map((timeline) => cloneTimeline(timeline));
      timelines.splice(this.selectedTimelineIndex + 1, 0, duplicate);
      this.data = sanitizeEditorDocument({ timelines }, DEFAULT_TIMELINE_DATA);
      this.selectedTimelineIndex = this.selectedTimelineIndex + 1;
      this.normalizeEditorState();
      this.renderWithStatus("info", "Duplicated timeline.");
  }

  private deleteTimeline(): void {
    if (this.data.timelines.length <= 1) {
      return;
    }

    const timelines = this.data.timelines.filter((_, index) => index !== this.selectedTimelineIndex);
    this.data = sanitizeEditorDocument({ timelines }, DEFAULT_TIMELINE_DATA);
    this.normalizeEditorState();
    this.renderWithStatus("info", "Deleted timeline.");
  }

  private addKeyframe(): void {
      this.updateSelectedTimeline((timeline) => {
        const positionType = getTimelinePositionType(timeline);
        const nextFrame = createNextKeyframe(timeline, timeline.keyframes, this.selectedKeyframeIndex);
        timeline.keyframes = this.sortKeyframesByPosition([...timeline.keyframes, nextFrame], positionType);
        this.selectedKeyframeIndex = timeline.keyframes.indexOf(nextFrame);
      });
      this.render();
  }

  private deleteKeyframe(): void {
    const timeline = this.getSelectedTimeline();
    if (timeline.keyframes.length === 0) {
      return;
    }

    this.updateSelectedTimeline((candidate) => {
      candidate.keyframes = candidate.keyframes.filter((_, index) => index !== this.selectedKeyframeIndex);
      this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, candidate.keyframes.length);
    });
    this.render();
  }

  private duplicateKeyframe(): void {
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
      timeline.keyframes = this.sortKeyframesByPosition([...timeline.keyframes, duplicate], positionType);
      this.selectedKeyframeIndex = timeline.keyframes.indexOf(duplicate);
    });
    this.renderWithStatus("info", "Duplicated selected keyframe.");
  }

  private applyTextFieldChange(field: string, input: HTMLInputElement | HTMLSelectElement): void {
    this.pendingFocus = captureFocusSnapshot(this.container, field, input);
    if (!this.applyStringField(field, input.value)) {
      return;
    }

    this.setStatus("info", "Editing timeline data.");
    this.render();
  }

  private applyRangeFieldInput(field: string, input: HTMLInputElement): void {
    const value = Number(input.value);
    if (!Number.isFinite(value) || !this.applyNumberField(field, value, false)) {
      return;
    }

    syncNumberFieldValues(this.container, field, value, input);
    this.setStatus("info", "Editing timeline data.");
  }

  private applyNumericFieldChange(field: string, input: HTMLInputElement): void {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.pendingFocus = captureFocusSnapshot(this.container, field, input);
    if (!this.applyNumberField(field, value, true)) {
      return;
    }

    this.setStatus("info", "Editing timeline data.");
    this.render();
  }

  private applyStringField(field: string, value: string): boolean {
    return this.applyTimelineStringField(field, value)
      || this.applyKeyframeStringField(field, value)
      || this.applyTransformStringField(field, value);
  }

  private applyNumberField(field: string, value: number, shouldRender: boolean): boolean {
    return this.applyTimelineNumberField(field, value)
      || this.applyKeyframeNumberField(field, value, shouldRender)
      || this.applyTransformNumberField(field, value);
  }

  private applyTimelineStringField(field: string, value: string): boolean {
    switch (field) {
      case "id":
        this.updateSelectedTimeline((timeline) => {
          timeline.id = value;
        });
        return true;
      case "positionType":
        this.updateSelectedTimeline((timeline) => {
          const nextPositionType = value === "percent" ? "percent" : "time";
          if (nextPositionType === timeline.positionType) {
            return;
          }

          if (nextPositionType === "percent") {
            convertTimelineKeyframesToPercent(timeline, DEFAULT_TIMELINE_DATA.duration ?? 1);
            return;
          }

          convertTimelineKeyframesToTime(timeline, DEFAULT_TIMELINE_DATA.duration ?? 1200);
        });
        this.normalizeEditorState();
        return true;
      case "translateCustomUnit":
        this.updateSelectedTimeline((timeline) => {
          timeline.translateConfig = {
            ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
            customUnit: value,
          };
        });
        return true;
      case "translateUnit":
        this.updateSelectedTimeline((timeline) => {
          timeline.translateConfig = {
            ...(timeline.translateConfig ?? { unit: DEFAULT_TRANSLATE_CONFIG.unit }),
            unit: value as TranslateUnit,
          };
        });
        return true;
      default:
        return false;
    }
  }

  private applyKeyframeStringField(field: string, value: string): boolean {
    if (field !== "timingFunction") {
      return false;
    }

    this.withSelectedKeyframe((_, keyframe) => {
      const trimmed = value.trim();
      if (trimmed === "") {
        delete keyframe.timingFunction;
      } else {
        keyframe.timingFunction = trimmed;
      }
    });
    return true;
  }

  private applyTransformStringField(field: string, value: string): boolean {
    if (!field.startsWith("transform-kind-")) {
      return false;
    }

    const index = Number(field.slice("transform-kind-".length));
    this.applyEditedTransforms((timeline) =>
      replaceTransformKind(timeline, this.selectedKeyframeIndex, index, value as TransformKind)
    );
    return true;
  }

  private applyTimelineNumberField(field: string, value: number): boolean {
    switch (field) {
      case "duration":
        this.updateSelectedTimeline((timeline) => {
          if (timeline.positionType === "percent") {
            return;
          }

          timeline.duration = Math.max(1, Math.round(value));
          clampTimelineKeyframesToDuration(timeline);
        });
        this.normalizeEditorState();
        return true;
      default:
        return false;
    }
  }

  private applyKeyframeNumberField(field: string, value: number, shouldRender: boolean): boolean {
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
          keyframes.splice(0, keyframes.length, ...this.sortKeyframesByPosition(keyframes, positionType));
          this.selectedKeyframeIndex = keyframes.indexOf(selected);
        }, shouldRender);
        return true;
      case "opacity":
        this.commitEditorChange(() => {
          this.withSelectedKeyframe((_, keyframe) => {
            upsertKeyframeProperty(keyframe, createOpacityProperty(clampNumber(value, 0, 1)));
          });
        }, {
          status: { tone: "info", message: "Editing timeline data." },
          render: shouldRender,
        });
        return true;
      default:
        return false;
    }
  }

  private applyTransformNumberField(field: string, value: number): boolean {
    const match = /^transform-(x|y|value)-(\d+)$/.exec(field);
    if (!match) {
      return false;
    }

    const transformField = match[1] as "x" | "y" | "value";
    const index = Number(match[2]);
    this.applyEditedTransforms((timeline) =>
      setTransformFieldValue(timeline, this.selectedKeyframeIndex, index, transformField, value)
    );
    return true;
  }

  private setTimingFunctionPreset(value: string): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        keyframe.timingFunction = value;
      });
      this.pendingFocus = {
        field: "timingFunction",
        index: 0,
        selectionStart: value.length,
        selectionEnd: value.length,
      };
    }, { status: { tone: "info", message: "Editing timeline data." } });
  }

  private clearTimingFunction(): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        delete keyframe.timingFunction;
      });
      this.pendingFocus = {
        field: "timingFunction",
        index: 0,
        selectionStart: 0,
        selectionEnd: 0,
      };
    }, { status: { tone: "info", message: "Editing timeline data." } });
  }

  private moveSelectedTransform(index: number, direction: -1 | 1): void {
    this.commitEditorChange(() => {
      this.applyEditedTransforms((timeline) => moveTransform(
        timeline,
        this.selectedKeyframeIndex,
        index,
        direction,
      ));
    }, { status: { tone: "info", message: "Reordered transforms." } });
  }

  private deleteSelectedTransform(index: number): void {
    this.commitEditorChange(() => {
      this.applyEditedTransforms((timeline) => removeTransform(
        timeline,
        this.selectedKeyframeIndex,
        index,
      ));
    }, { status: { tone: "info", message: "Removed transform." } });
  }

  private addSelectedTransform(kind: TransformKind): void {
    this.commitEditorChange(() => {
      let addedInline = false;
      this.withSelectedKeyframe((_, keyframe) => {
        if (hasKeyframeProperty(keyframe, "transform")) {
          return;
        }

        upsertKeyframeProperty(keyframe, createTransformProperty([createDefaultTransform(kind)]));
        addedInline = true;
      });
      if (!addedInline) {
        this.applyEditedTransforms((timeline) => addTransform(
          timeline,
          this.selectedKeyframeIndex,
          kind,
        ));
      }
    }, { status: { tone: "info", message: `Added ${kind} transform.` } });
  }

  private addOpacityProperty(): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        upsertKeyframeProperty(keyframe, createOpacityProperty(1));
      });
    }, { status: { tone: "info", message: "Added opacity to the selected keyframe." } });
  }

  private deleteOpacityProperty(): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        deleteKeyframeProperty(keyframe, "opacity");
      });
    }, { status: { tone: "info", message: "Deleted opacity from the selected keyframe." } });
  }

  private deleteTransformProperty(): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        deleteKeyframeProperty(keyframe, "transform");
      });
    }, { status: { tone: "info", message: "Deleted transforms from the selected keyframe." } });
  }

  private clearTransformProperty(): void {
    this.commitEditorChange(() => {
      this.withSelectedKeyframe((_, keyframe) => {
        upsertKeyframeProperty(keyframe, createTransformProperty([]));
      });
    }, { status: { tone: "info", message: "Cleared transforms to none for the selected keyframe." } });
  }

  private updateSelectedTimeline(update: (timeline: WebKeyframesTimeline) => void): void {
    const timeline = this.getSelectedTimeline();
    update(timeline);
    this.normalizeEditorState();
  }

  private updateSelectedTimelineKeyframes(
    update: (keyframes: WebKeyframe[], timeline: WebKeyframesTimeline) => void,
    shouldRender = true,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframes = timeline.keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));

    update(keyframes, timeline);
    timeline.keyframes = keyframes.map((keyframe) => cloneSparseKeyframe(keyframe));
    this.normalizeEditorState();
    this.setStatus("info", "Editing timeline data.");
    if (shouldRender) {
      this.render();
    }
  }

  private commitEditorChange(
    update: () => void,
    options: {
      status?: { tone: "info" | "success" | "error"; message: string };
      render?: boolean;
    } = {},
  ): void {
    update();
    if (options.status) {
      this.setStatus(options.status.tone, options.status.message);
    }
    if (options.render ?? true) {
      this.render();
    }
  }

  private withSelectedKeyframe(
    run: (timeline: WebKeyframesTimeline, keyframe: WebKeyframe) => void,
  ): void {
    const timeline = this.getSelectedTimeline();
    const keyframe = timeline.keyframes[this.selectedKeyframeIndex];
    if (!keyframe) {
      return;
    }

    run(timeline, keyframe);
  }

  private applyEditedTransforms(
    edit: (timeline: WebKeyframesTimeline) => WebKeyframesTimeline | ReturnType<typeof moveTransform>,
  ): void {
    this.updateSelectedTimeline((timeline) => {
      timeline.keyframes = cloneTimeline(edit(timeline)).keyframes;
    });
  }

  private sortKeyframesByPosition(
    keyframes: WebKeyframe[],
    positionType: ReturnType<typeof getTimelinePositionType>,
  ): WebKeyframe[] {
    return [...keyframes].sort(
      (left, right) => getEditorKeyframePosition(left, positionType) - getEditorKeyframePosition(right, positionType),
    );
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

  private renderWithStatus(tone: "info" | "success" | "error", message: string): void {
    this.setStatus(tone, message);
    this.render();
  }

  private normalizeEditorState(): void {
    this.data = sanitizeEditorDocument(this.data, DEFAULT_TIMELINE_DATA);
    this.selectedTimelineIndex = clampIndex(this.selectedTimelineIndex, this.data.timelines.length);
    this.selectedKeyframeIndex = clampIndex(this.selectedKeyframeIndex, this.getSelectedTimeline().keyframes.length);
  }

  private reset(): void {
    this.disposeAppliedPreview();
    this.data = cloneDocument(this.initialData);
    this.selectedTimelineIndex = 0;
    this.selectedKeyframeIndex = 0;
    this.clearPreviewPanel();
    this.setStatus("success", "Reset editor data to the initial state.");
    this.render();
  }

  private openGeneratedPreview(kind: "json" | "css"): void {
    this.openPreview(
      kind === "json" ? "JSON Preview" : "CSS Preview",
      () => (kind === "json" ? this.toJson() : this.toCss()),
    );
  }

  private openPreview(title: string, getContent: () => string): void {
    try {
      this.setPreviewPanel(title, getContent());
      this.setStatus("success", `Opened ${title.toLowerCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.clearPreviewPanel();
      this.setStatus("error", message);
    }

    this.render();
  }

  private closePreview(message: string): void {
    this.clearPreviewPanel();
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

  private setPreviewPanel(title: string, content: string): void {
    this.previewTitle = title;
    this.previewContent = content;
  }

  private clearPreviewPanel(): void {
    this.previewTitle = null;
    this.previewContent = "";
  }

  private restoreFocus(): void {
    this.pendingFocus = restoreFocusSnapshot(this.container, this.pendingFocus);
  }

  private notifyDataChangeIfNeeded(): void {
    if (this.onDataChange === null) {
      return;
    }

    const nextDataJson = JSON.stringify(this.data);
    if (nextDataJson === this.lastNotifiedDataJson) {
      return;
    }

    this.lastNotifiedDataJson = nextDataJson;
    this.onDataChange(cloneDocument(this.data));
  }

  private startDragging(event: MouseEvent): void {
    const ownerWindow = this.root.ownerDocument.defaultView;
    const session = beginPanelDrag(this.container, ownerWindow, event);
    if (!session || !ownerWindow) {
      return;
    }

    this.panelPosition = session.panelPosition;
    this.dragState = session.dragState;
    ownerWindow.addEventListener("mousemove", this.handleDragMove);
    ownerWindow.addEventListener("mouseup", this.handleDragEnd);
  }

  private updateDragPosition(event: MouseEvent): void {
    const ownerWindow = this.root.ownerDocument.defaultView;
    const panelPosition = updatePanelDrag(this.container, ownerWindow, this.dragState, event);
    if (panelPosition === null) {
      return;
    }

    this.panelPosition = panelPosition;
    this.applyPanelPosition();
  }

  private stopDragging(): void {
    const ownerWindow = this.root.ownerDocument.defaultView;
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", this.handleDragMove);
      ownerWindow.removeEventListener("mouseup", this.handleDragEnd);
    }

    finishPanelDrag(this.container);
    this.dragState = null;
  }

  private applyPanelPosition(): void {
    applyPanelPosition(this.container, this.panelPosition);
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

function isEditorMountRoot(value: unknown): value is HTMLElement | ShadowRoot {
  return typeof value === "object"
    && value !== null
    && "ownerDocument" in value
    && "append" in value;
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

function convertTimelineKeyframesToPercent(timeline: WebKeyframesTimeline, fallbackDuration: number): void {
  const duration = Math.max(timeline.duration ?? fallbackDuration, 1);
  timeline.positionType = "percent";
  delete timeline.duration;
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = cloneSparseKeyframe(keyframe);
    const percent = typeof nextKeyframe.time === "number" ? (nextKeyframe.time / duration) * 100 : 0;
    applyEditorKeyframePosition(nextKeyframe, "percent", clampNumber(percent, 0, 100));
    return nextKeyframe;
  });
}

function convertTimelineKeyframesToTime(timeline: WebKeyframesTimeline, nextDuration: number): void {
  timeline.positionType = "time";
  timeline.duration = Math.max(1, Math.round(nextDuration));
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
}

function clampTimelineKeyframesToDuration(timeline: WebKeyframesTimeline): void {
  timeline.keyframes = timeline.keyframes.map((keyframe) => {
    const nextKeyframe = cloneSparseKeyframe(keyframe);
    applyEditorKeyframePosition(
      nextKeyframe,
      "time",
      clampNumber(typeof nextKeyframe.time === "number" ? nextKeyframe.time : 0, 0, timeline.duration ?? 1),
    );
    return nextKeyframe;
  });
}

function applyPreview(
  ownerDocument: Document,
  timeline: WebKeyframesTimeline,
): ActivePreview {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("Preview is not available in this environment.");
  }

  const normalizedTimeline = normalizeWebKeyframesTimeline(timeline);
  const targets = findPreviewTargets(ownerDocument, normalizedTimeline.id);
  if (targets.length === 0) {
    throw new Error(`No elements using animation-name "${normalizedTimeline.id}" were found.`);
  }

  const previewName = `${normalizedTimeline.id}__wkf_preview`;
  const styleElement = ensurePreviewStyleElement(ownerDocument);
  styleElement.textContent = generatePreviewCssText(timeline, previewName, normalizedTimeline.id);

  const appliedTargets = targets.map((element) => ({
    element,
    inlineAnimationName: element.style.animationName,
  }));

  for (const target of appliedTargets) {
    const computedAnimationName = ownerWindow.getComputedStyle(target.element).animationName;
    const nextAnimationName = replaceAnimationName(computedAnimationName, normalizedTimeline.id, previewName);
    target.element.style.animationName = "none";
    void target.element.offsetWidth;
    target.element.style.animationName = nextAnimationName;
  }

  return {
    styleElement,
    targets: appliedTargets,
  };
}

function clearAppliedPreview(activePreview: ActivePreview | null): void {
  if (activePreview === null) {
    return;
  }

  for (const target of activePreview.targets) {
    target.element.style.animationName = target.inlineAnimationName;
  }

  activePreview.styleElement.remove();
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

function generatePreviewCssText(timeline: WebKeyframesTimeline, previewName: string, currentName: string): string {
  const css = generateCss({ timelines: [timeline] });
  if (previewName === currentName) {
    return css;
  }

  return css.replace(/^@keyframes\s+[^\s{]+\s+\{/, `@keyframes ${previewName} {`);
}

async function writeClipboardText(windowObject: Window | null, text: string): Promise<void> {
  const clipboard = windowObject?.navigator?.clipboard;

  if (!clipboard?.writeText) {
    throw new Error("Clipboard API is not available.");
  }

  await clipboard.writeText(text);
}
