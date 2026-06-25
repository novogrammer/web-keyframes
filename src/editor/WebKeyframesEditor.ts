import { generateCss } from "../core/generateCss.js";
import { cloneDocument, cloneTimeline, DEFAULT_TRANSLATE_CONFIG } from "../core/normalize.js";
import type { TransformKind, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import { deriveEditorRenderState, sanitizeEditorDocument, clampIndex } from "./editorModel.js";
import { createEditorCollectionController } from "./editorCollectionController.js";
import { createEditorKeyframePropertyController } from "./editorKeyframePropertyController.js";
import { createEditorLifecycleController } from "./editorLifecycleController.js";
import { createEditorPreviewController } from "./editorPreviewController.js";
import { createEditorSectionInputController } from "./editorSectionInputController.js";
import {
  clearPreviewPanel,
  createEditorState,
  normalizeEditorState,
  resetEditorState,
  setStatus,
} from "./editorStateController.js";
import { createEditorContainer } from "./editorShell.js";
import { renderEditorPanel } from "./editorView.js";

type WebKeyframesEditorOptions = {
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
        { kind: "opacity", value: 0 },
        {
          kind: "transform",
          value: [
            { kind: "translate", x: 0, y: 40 },
            { kind: "scale", x: 1, y: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
      ],
    },
    {
      percent: 100,
      properties: [
        { kind: "opacity", value: 1 },
        {
          kind: "transform",
          value: [
            { kind: "translate", x: 0, y: 0 },
            { kind: "scale", x: 1, y: 1 },
            { kind: "rotate", value: 0 },
          ],
        },
      ],
    },
  ],
};

const DEFAULT_EDITOR_DATA: WebKeyframesDocument = {
  timelines: [cloneTimeline(DEFAULT_TIMELINE_DATA)],
};

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly initialData: WebKeyframesDocument;
  private readonly state;
  private readonly collectionController;
  private readonly propertyController;
  private readonly previewController;
  private readonly sectionInputController;
  private readonly lifecycleController;
  private container: HTMLElement | null = null;
  private mounted = false;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }

    this.root = options.root;
    this.initialData = sanitizeEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA, DEFAULT_TIMELINE_DATA);
    this.state = createEditorState(this.initialData, DEFAULT_TIMELINE_DATA);
    this.collectionController = createEditorCollectionController(this.state, DEFAULT_TIMELINE_DATA);
    this.propertyController = createEditorKeyframePropertyController(this.state, DEFAULT_TIMELINE_DATA);
    this.previewController = createEditorPreviewController(this.root, this.state, () => this.toJson(), () => this.toCss());
    this.sectionInputController = createEditorSectionInputController(this.state, DEFAULT_TIMELINE_DATA);
    this.lifecycleController = createEditorLifecycleController(this.root, {
      shortcut: options.shortcut,
      onToggle: () => this.toggle(),
      onEscape: () => {
        if (this.state.previewTitle !== null) {
          this.previewController.closePreview("Closed preview.");
          this.render();
        }
      },
      onClick: (event) => this.handleDelegatedClick(event),
      onInput: (event) => this.handleDelegatedInput(event),
      onChange: (event) => this.handleDelegatedChange(event),
    });
  }

  mount(): void {
    if (this.mounted) {
      throw new Error("mount() has already been called.");
    }

    const ownerDocument = this.root.ownerDocument;
    const container = createEditorContainer(ownerDocument);
    this.container = container;
    this.render();
    this.lifecycleController.mount(container);
    this.root.append(container);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }

    this.previewController.disposeAppliedPreview();
    this.lifecycleController.unmount(this.container);
    this.container?.remove();
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    this.lifecycleController.show(this.container!);
  }

  hide(): void {
    this.ensureMounted();
    this.lifecycleController.hide(this.container!);
  }

  toggle(): void {
    this.ensureMounted();
    this.lifecycleController.toggle(this.container!);
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.state.data);
  }

  setData(data: WebKeyframesDocument): void {
    this.state.data = sanitizeEditorDocument(data, DEFAULT_TIMELINE_DATA);
    normalizeEditorState(this.state, DEFAULT_TIMELINE_DATA);
    if (this.container !== null) {
      this.render();
    }
  }

  toJson(): string {
    return JSON.stringify(cloneDocument(this.state.data), null, 2);
  }

  toCss(): string {
    return generateCss(this.state.data);
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
      this.state.data,
      this.state.selectedTimelineIndex,
      this.state.selectedKeyframeIndex,
      DEFAULT_TIMELINE_DATA,
    );
    this.state.selectedTimelineIndex = renderState.selectedTimelineIndex;
    this.state.selectedKeyframeIndex = renderState.selectedKeyframeIndex;
    this.container.innerHTML = renderEditorPanel(renderState, {
      selectedTimelineIndex: this.state.selectedTimelineIndex,
      selectedKeyframeIndex: this.state.selectedKeyframeIndex,
      previewTitle: this.state.previewTitle,
      previewContent: this.state.previewContent,
      statusMessage: this.state.statusMessage,
      statusTone: this.state.statusTone,
    });
    this.lifecycleController.bindDragging(this.container, this.state.panelPosition, (position) => {
      this.state.panelPosition = position;
    });
    queueMicrotask(() => this.lifecycleController.restoreFocus(this.container, this.state.pendingFocus, () => {
      this.state.pendingFocus = null;
    }));
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

    if (action === "hide") {
      this.hide();
      return;
    }
    if (action === "reset") {
      this.previewController.disposeAppliedPreview();
      resetEditorState(this.state, this.initialData);
      setStatus(this.state, "success", "Reset editor data to the initial state.");
      this.render();
      return;
    }
    if (action === "select-timeline") {
      this.state.selectedTimelineIndex = clampIndex(Number(actionTarget.dataset.wkfIndex ?? "0"), this.state.data.timelines.length);
      normalizeEditorState(this.state, DEFAULT_TIMELINE_DATA);
      this.render();
      return;
    }
    if (action === "add-timeline" || action === "duplicate-timeline" || action === "delete-timeline") {
      this.collectionController[action === "add-timeline" ? "addTimeline" : action === "duplicate-timeline" ? "duplicateTimeline" : "deleteTimeline"]();
      this.render();
      return;
    }
    if (action === "select-keyframe") {
      this.state.selectedKeyframeIndex = clampIndex(Number(actionTarget.dataset.wkfIndex ?? "0"), renderStateKeyframeLength(this.state));
      this.render();
      return;
    }
    if (action === "set-timing-function") {
      this.propertyController.setTimingFunctionPreset(actionTarget.dataset.wkfValue ?? "");
      this.render();
      return;
    }
    if (action === "clear-timing-function") {
      this.propertyController.clearTimingFunction();
      this.render();
      return;
    }
    if (action === "move-transform-up" || action === "move-transform-down") {
      this.propertyController.moveSelectedTransform(Number(actionTarget.dataset.wkfIndex ?? "0"), action === "move-transform-up" ? -1 : 1);
      this.render();
      return;
    }
    if (action === "delete-transform") {
      this.propertyController.deleteSelectedTransform(Number(actionTarget.dataset.wkfIndex ?? "0"));
      this.render();
      return;
    }
    if (action === "add-transform") {
      this.propertyController.addSelectedTransform((actionTarget.dataset.wkfKind ?? "translate") as TransformKind);
      this.render();
      return;
    }
    if (action === "add-opacity") {
      this.propertyController.addOpacityProperty();
      this.render();
      return;
    }
    if (action === "delete-opacity") {
      this.propertyController.deleteOpacityProperty();
      this.render();
      return;
    }
    if (action === "delete-transforms") {
      this.propertyController.deleteTransformProperty();
      this.render();
      return;
    }
    if (action === "clear-transforms") {
      this.propertyController.clearTransformProperty();
      this.render();
      return;
    }
    if (action === "add-keyframe" || action === "delete-keyframe" || action === "duplicate-keyframe") {
      this.collectionController[action === "add-keyframe" ? "addKeyframe" : action === "delete-keyframe" ? "deleteKeyframe" : "duplicateKeyframe"]();
      this.render();
      return;
    }
    if (action === "copy-json" || action === "copy-css") {
      void this.handleCopyAction(action === "copy-json" ? "json" : "css");
      return;
    }
    if (action === "run-preview") {
      this.previewController.runPreview();
      this.render();
      return;
    }
    if (action === "reset-preview") {
      this.previewController.resetAppliedPreview();
      this.render();
      return;
    }
    if (action === "view-json" || action === "view-css") {
      this.previewController.openGeneratedPreview(action === "view-json" ? "json" : "css");
      this.render();
      return;
    }
    if (action === "close-preview") {
      this.previewController.closePreview("Closed preview.");
      this.render();
    }
  }

  private async handleCopyAction(kind: "json" | "css"): Promise<void> {
    await this.previewController.copyPayload(kind);
    this.render();
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
        this.state.pendingFocus = this.lifecycleController.captureFocusSnapshot(this.container, field, input);
        if (this.sectionInputController.applyStringField(field, input.value)) {
          setStatus(this.state, "info", "Editing timeline data.");
          this.render();
        }
      }
      return;
    }

    if (input.type === "range") {
      if (eventType === "input") {
        const value = Number(input.value);
        if (!Number.isFinite(value) || !this.sectionInputController.applyNumberField(field, value)) {
          return;
        }

        this.lifecycleController.syncNumberFieldValues(this.container, field, value, input);
        setStatus(this.state, "info", "Editing timeline data.");
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
      this.state.pendingFocus = this.lifecycleController.captureFocusSnapshot(this.container, field, input);
      if (this.sectionInputController.applyStringField(field, input.value)) {
        setStatus(this.state, "info", "Editing timeline data.");
        this.render();
      }
    }
  }

  private applyNumericFieldChange(field: string, input: HTMLInputElement): void {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.state.pendingFocus = this.lifecycleController.captureFocusSnapshot(this.container, field, input);
    if (!this.sectionInputController.applyNumberField(field, value)) {
      return;
    }

    setStatus(this.state, "info", "Editing timeline data.");
    this.render();
  }
}

function renderStateKeyframeLength(state: ReturnType<typeof createEditorState>): number {
  return state.data.timelines[state.selectedTimelineIndex]?.keyframes.length ?? 0;
}
