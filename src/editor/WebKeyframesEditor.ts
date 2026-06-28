import { generateCss } from "../core/generateCss.js";
import { cloneDocument, cloneTimeline, DEFAULT_TRANSLATE_CONFIG } from "../core/normalize.js";
import type { TransformKind, WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import {
  createEditorState,
  dispatchEditorAction,
  type EditorAction,
  type EditorState,
  normalizeEditorState,
  renderEditorPanel,
  coerceEditorDocument,
} from "./editorCore.js";
import { EditorDomController } from "./editorDom.js";

type WebKeyframesEditorOptions = {
  root: HTMLElement;
  initialData?: WebKeyframesDocument;
  shortcut?: string | false;
};

const DEFAULT_TIMELINE_DATA: WebKeyframesTimeline = {
  animationName: "new-animation",
  positionType: "percent",
  translateConfig: { unit: DEFAULT_TRANSLATE_CONFIG.unit },
  keyframes: [
    {
      percent: 0,
      properties: [
        { kind: "opacity", value: 0 },
        { kind: "transform", value: [{ kind: "translate", x: 0, y: 40 }, { kind: "scale", x: 1, y: 1 }, { kind: "rotate", value: 0 }] },
      ],
    },
    {
      percent: 100,
      properties: [
        { kind: "opacity", value: 1 },
        { kind: "transform", value: [{ kind: "translate", x: 0, y: 0 }, { kind: "scale", x: 1, y: 1 }, { kind: "rotate", value: 0 }] },
      ],
    },
  ],
};

const DEFAULT_EDITOR_DATA: WebKeyframesDocument = { timelines: [cloneTimeline(DEFAULT_TIMELINE_DATA)] };

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly initialData: WebKeyframesDocument;
  private readonly state: EditorState;
  private readonly dom: EditorDomController;
  private container: HTMLElement | null = null;
  private mounted = false;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }
    this.root = options.root;
    this.initialData = coerceEditorDocument(options.initialData ?? DEFAULT_EDITOR_DATA, DEFAULT_TIMELINE_DATA);
    this.state = createEditorState(this.initialData, DEFAULT_TIMELINE_DATA);
    this.dom = new EditorDomController(this.root, this.state, {
      shortcut: options.shortcut,
      getJson: () => this.toJson(),
      getCss: () => this.toCss(),
      onToggle: () => this.toggle(),
      onEscape: () => {
        if (this.state.previewTitle !== null) {
          this.dom.closePreview("Closed preview.");
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
    this.container = this.dom.createContainer();
    this.render();
    this.dom.mount(this.container);
    this.root.append(this.container);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }
    this.dom.disposeAppliedPreview();
    this.dom.unmount();
    this.container?.remove();
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    this.dom.show(this.container!);
  }

  hide(): void {
    this.ensureMounted();
    this.dom.hide(this.container!);
  }

  toggle(): void {
    this.ensureMounted();
    this.dom.toggle(this.container!);
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.state.data);
  }

  setData(data: WebKeyframesDocument): void {
    this.state.data = coerceEditorDocument(data, DEFAULT_TIMELINE_DATA);
    normalizeEditorState(this.state, DEFAULT_TIMELINE_DATA);
    if (this.container) {
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
    if (!this.container) {
      return;
    }
    this.container.innerHTML = renderEditorPanel(this.state, DEFAULT_TIMELINE_DATA);
    this.dom.syncPanel(this.container, this.state.panelPosition);
    queueMicrotask(() => this.dom.restoreFocus(this.container, this.state.pendingFocus, () => {
      this.state.pendingFocus = null;
    }));
  }

  private handleDelegatedClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !this.container) {
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
    const immediate = this.clickActions[action];
    if (immediate) {
      immediate(actionTarget);
      return;
    }
    if (action === "copy-json" || action === "copy-css") {
      void this.handleCopy(action === "copy-json" ? "json" : "css");
    }
  }

  private readonly clickActions: Record<string, (target: HTMLElement) => void> = {
    hide: () => this.hide(),
    reset: () => this.runAction(() => {
      this.dom.disposeAppliedPreview();
      return { type: "reset", initialData: this.initialData };
    }),
    "add-timeline": () => this.runAction({ type: "collectionAction", target: "timeline", operation: "add" }),
    "duplicate-timeline": () => this.runAction({ type: "collectionAction", target: "timeline", operation: "duplicate" }),
    "delete-timeline": () => this.runAction({ type: "collectionAction", target: "timeline", operation: "delete" }),
    "select-timeline": (target) => this.runAction({ type: "collectionAction", target: "timeline", operation: "select", index: actionIndex(target) }),
    "add-keyframe": () => this.runAction({ type: "collectionAction", target: "keyframe", operation: "add" }),
    "duplicate-keyframe": () => this.runAction({ type: "collectionAction", target: "keyframe", operation: "duplicate" }),
    "delete-keyframe": () => this.runAction({ type: "collectionAction", target: "keyframe", operation: "delete" }),
    "select-keyframe": (target) => this.runAction({ type: "collectionAction", target: "keyframe", operation: "select", index: actionIndex(target) }),
    "set-timing-function": (target) => this.runAction({ type: "fieldAction", field: "timingFunction", value: target.dataset.wkfValue ?? "" }),
    "clear-timing-function": () => this.runAction({ type: "fieldAction", field: "timingFunction", operation: "clear", value: "" }),
    "add-opacity": () => this.runAction({ type: "fieldAction", field: "opacity", operation: "add", value: 1 }),
    "delete-opacity": () => this.runAction({ type: "fieldAction", field: "opacity", operation: "delete", value: 0 }),
    "add-transform": (target) => this.runAction({ type: "transformAction", operation: "add", kind: (target.dataset.wkfKind ?? "translate") as TransformKind }),
    "delete-transform": (target) => this.runAction({ type: "transformAction", operation: "delete", index: actionIndex(target) }),
    "move-transform-up": (target) => this.runAction({ type: "transformAction", operation: "move", index: actionIndex(target), direction: -1 }),
    "move-transform-down": (target) => this.runAction({ type: "transformAction", operation: "move", index: actionIndex(target), direction: 1 }),
    "delete-transforms": () => this.runAction({ type: "transformAction", operation: "delete" }),
    "clear-transforms": () => this.runAction({ type: "transformAction", operation: "clear" }),
    "run-preview": () => { this.dom.runPreview(); this.render(); },
    "reset-preview": () => { this.dom.resetAppliedPreview(); this.render(); },
    "view-json": () => { this.dom.openPreview("json"); this.render(); },
    "view-css": () => { this.dom.openPreview("css"); this.render(); },
    "close-preview": () => { this.dom.closePreview("Closed preview."); this.render(); },
  };

  private async handleCopy(kind: "json" | "css"): Promise<void> {
    await this.dom.copyPayload(kind);
    this.render();
  }

  private handleDelegatedInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset.wkfField) {
      this.handleFieldUpdate(target.dataset.wkfField, target, "input");
    }
  }

  private handleDelegatedChange(event: Event): void {
    const target = event.target;
    if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.wkfField) {
      this.handleFieldUpdate(target.dataset.wkfField, target, "change");
    }
  }

  private handleFieldUpdate(field: string, input: HTMLInputElement | HTMLSelectElement, eventType: "input" | "change"): void {
    if (input instanceof HTMLSelectElement) {
      if (eventType === "change") {
        this.commitFieldEdit({ type: "fieldAction", field, value: input.value }, field, input);
      }
      return;
    }
    if (input.type === "range") {
      if (eventType === "input") {
        const value = Number(input.value);
        if (!Number.isFinite(value) || !dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, { type: "fieldAction", field, value })) {
          return;
        }
        this.dom.syncNumberFieldValues(this.container, field, value, input);
        return;
      }
      const value = Number(input.value);
      if (Number.isFinite(value)) {
        this.commitFieldEdit({ type: "fieldAction", field, value }, field, input);
      }
      return;
    }
    if (input.type === "number") {
      if (eventType === "change") {
        const value = Number(input.value);
        if (Number.isFinite(value)) {
          this.commitFieldEdit({ type: "fieldAction", field, value }, field, input);
        }
      }
      return;
    }
    if (eventType === "input") {
      this.commitFieldEdit({ type: "fieldAction", field, value: input.value }, field, input);
    }
  }

  private commitFieldEdit(action: { type: "fieldAction"; field: string; value: string | number }, field: string, input: HTMLInputElement | HTMLSelectElement): void {
    const focusSnapshot = this.dom.captureFocusSnapshot(this.container, field, input);
    if (dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, { ...action, focusSnapshot })) {
      this.render();
    }
  }

  private runAction(actionOrFactory: EditorAction | (() => EditorAction)): void {
    const action = typeof actionOrFactory === "function" ? actionOrFactory() : actionOrFactory;
    if (dispatchEditorAction(this.state, DEFAULT_TIMELINE_DATA, action)) {
      this.render();
    }
  }
}

function actionIndex(target: HTMLElement): number {
  return Number(target.dataset.wkfIndex ?? "0");
}
