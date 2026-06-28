import { generateCss } from "../core/generateCss.js";
import { cloneDocument, cloneTimeline, DEFAULT_TRANSLATE_CONFIG } from "../core/normalize.js";
import type { TransformKind, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import { deriveEditorRenderState, sanitizeEditorDocument } from "./editorModel.js";
import { EditorLifecycleController } from "./controller/EditorLifecycleController.js";
import { EditorPreviewController } from "./controller/EditorPreviewController.js";
import { dispatchEditorAction, type EditorAction } from "./editorReducer.js";
import {
  type EditorState,
  createEditorState,
  normalizeEditorState,
} from "./editorStateController.js";
import { createEditorContainer } from "./editorShell.js";
import { renderEditorPanel } from "./view/editorView.js";

type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
};

const DEFAULT_TIMELINE_DATA: WebKeyframesTimeline = {
  animationName: "new-animation",
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
  private readonly state: EditorState;
  private readonly previewController: EditorPreviewController;
  private readonly lifecycleController: EditorLifecycleController;
  private container: HTMLElement | null = null;
  private mounted = false;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }

    this.root = options.root;
    this.initialData = sanitizeEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA, DEFAULT_TIMELINE_DATA);
    this.state = createEditorState(this.initialData, DEFAULT_TIMELINE_DATA);
    this.previewController = new EditorPreviewController(this.root, this.state, () => this.toJson(), () => this.toCss());
    this.lifecycleController = new EditorLifecycleController(this.root, {
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

    const syncHandler = this.clickActions[action];
    if (syncHandler) {
      syncHandler();
      return;
    }

    if (action === "select-timeline") {
      this.runAction({ type: "selectTimeline", index: getActionIndex(actionTarget) });
      return;
    }
    if (action === "select-keyframe") {
      this.runAction({ type: "selectKeyframe", index: getActionIndex(actionTarget) });
      return;
    }
    if (action === "set-timing-function") {
      this.runAction({ type: "setTimingFunctionPreset", value: actionTarget.dataset.wkfValue ?? "" });
      return;
    }
    if (action === "move-transform-up" || action === "move-transform-down") {
      this.runAction({
        type: "moveTransform",
        index: getActionIndex(actionTarget),
        direction: action === "move-transform-up" ? -1 : 1,
      });
      return;
    }
    if (action === "delete-transform") {
      this.runAction({ type: "deleteTransform", index: getActionIndex(actionTarget) });
      return;
    }
    if (action === "add-transform") {
      this.runAction({ type: "addTransform", kind: (actionTarget.dataset.wkfKind ?? "translate") as TransformKind });
      return;
    }
    if (action === "copy-json" || action === "copy-css") {
      void this.handleCopyAction(action === "copy-json" ? "json" : "css");
    }
  }

  private readonly clickActions: Record<string, () => void> = {
    hide: () => this.hide(),
    reset: () => this.runAction(() => {
      this.previewController.disposeAppliedPreview();
      return { type: "reset", initialData: this.initialData };
    }),
    "add-timeline": () => this.runAction({ type: "addTimeline" }),
    "duplicate-timeline": () => this.runAction({ type: "duplicateTimeline" }),
    "delete-timeline": () => this.runAction({ type: "deleteTimeline" }),
    "clear-timing-function": () => this.runAction({ type: "clearTimingFunction" }),
    "add-opacity": () => this.runAction({ type: "addOpacity" }),
    "delete-opacity": () => this.runAction({ type: "deleteOpacity" }),
    "delete-transforms": () => this.runAction({ type: "deleteTransforms" }),
    "clear-transforms": () => this.runAction({ type: "clearTransforms" }),
    "add-keyframe": () => this.runAction({ type: "addKeyframe" }),
    "delete-keyframe": () => this.runAction({ type: "deleteKeyframe" }),
    "duplicate-keyframe": () => this.runAction({ type: "duplicateKeyframe" }),
    "run-preview": () => this.runAndRender(() => this.previewController.runPreview()),
    "reset-preview": () => this.runAndRender(() => this.previewController.resetAppliedPreview()),
    "view-json": () => this.runAndRender(() => this.previewController.openGeneratedPreview("json")),
    "view-css": () => this.runAndRender(() => this.previewController.openGeneratedPreview("css")),
    "close-preview": () => this.runAndRender(() => this.previewController.closePreview("Closed preview.")),
  };

  private runAndRender(action: () => void): void {
    action();
    this.render();
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
        this.commitFieldEdit({ type: "applyStringField", field, value: input.value }, field, input);
      }
      return;
    }

    if (input.type === "range") {
      if (eventType === "input") {
        const value = Number(input.value);
        if (!Number.isFinite(value) || !dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, {
          type: "applyNumberField",
          field,
          value,
        })) {
          return;
        }

        this.lifecycleController.syncNumberFieldValues(this.container, field, value, input);
        return;
      }

      this.commitNumericFieldEdit(field, input);
      return;
    }

    if (input.type === "number") {
      if (eventType === "change") {
        this.commitNumericFieldEdit(field, input);
      }
      return;
    }

    if (eventType === "input") {
      this.commitFieldEdit({ type: "applyStringField", field, value: input.value }, field, input);
    }
  }

  private commitNumericFieldEdit(field: string, input: HTMLInputElement): void {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.commitFieldEdit({ type: "applyNumberField", field, value }, field, input);
  }

  private commitFieldEdit(
    action: { type: "applyStringField"; field: string; value: string } | { type: "applyNumberField"; field: string; value: number },
    field: string,
    input: HTMLInputElement | HTMLSelectElement,
  ): void {
    const focusSnapshot = this.lifecycleController.captureFocusSnapshot(this.container, field, input);
    if (!dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, { ...action, focusSnapshot })) {
      return;
    }

    this.render();
  }

  private runAction(
    actionOrFactory: EditorAction | (() => EditorAction),
  ): void {
    const action = typeof actionOrFactory === "function" ? actionOrFactory() : actionOrFactory;
    if (!dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, action)) {
      return;
    }
    this.render();
  }
}

function getActionIndex(actionTarget: HTMLElement): number {
  return Number(actionTarget.dataset.wkfIndex ?? "0");
}
