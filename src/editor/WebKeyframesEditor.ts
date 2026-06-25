import {
  cloneTimeline,
  createOpacityProperty,
  createTransformProperty,
  DEFAULT_TRANSLATE_CONFIG,
} from "../core/normalize.js";
import type {
  TransformKind,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "../core/types.js";
import {
  deriveEditorRenderState,
} from "./editorModel.js";
import {
  selectKeyframeIndex,
  selectTimelineIndex,
} from "./editorCollectionActions.js";
import { EditorCollectionController } from "./editorCollectionController.js";
import { EditorDataController } from "./editorDataController.js";
import {
  type FocusSnapshot,
  restoreFocusSnapshot,
} from "./editorInteraction.js";
import { EditorDragController } from "./editorDragController.js";
import { EditorInputController } from "./editorInputController.js";
import { EditorLifecycleController } from "./editorLifecycleController.js";
import { EditorStateController } from "./editorStateController.js";
import { EditorKeyframePropertyController } from "./editorKeyframePropertyController.js";
import { EditorPreviewController } from "./editorPreviewController.js";
import { EditorSectionInputController } from "./editorSectionInputController.js";
import {
  createEditorContainer,
  isEditorVisible,
  setEditorVisibility,
} from "./editorShell.js";
import { renderEditorPanel } from "./editorView.js";
import type { EditorFieldRegistry } from "./editorViewTypes.js";

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

type EditorActionPayload = {
  index?: number;
  kind?: string;
  value?: string;
};

type EditorActionHandler = (payload?: EditorActionPayload) => void;

export class WebKeyframesEditor {
  private readonly root: HTMLElement | ShadowRoot;
  private readonly initialData: WebKeyframesDocument;
  private readonly onDataChange: ((data: WebKeyframesDocument) => void) | null;
  private readonly lifecycleController: EditorLifecycleController;
  private readonly dragController: EditorDragController;
  private readonly dataController: EditorDataController;
  private readonly inputController: EditorInputController;
  private readonly collectionController: EditorCollectionController;
  private readonly stateController: EditorStateController;
  private readonly keyframePropertyController: EditorKeyframePropertyController;
  private readonly previewController: EditorPreviewController;
  private readonly sectionInputController: EditorSectionInputController;
  private readonly editorChromeActions: Record<string, EditorActionHandler>;
  private readonly timelineActions: Record<string, EditorActionHandler>;
  private readonly keyframeActions: Record<string, EditorActionHandler>;
  private readonly previewActions: Record<string, EditorActionHandler>;
  private data: WebKeyframesDocument;
  private selectedTimelineIndex = 0;
  private selectedKeyframeIndex = 0;
  private statusMessage = "Timeline order is explicit. Preview and CSS use the selected timeline or the full document consistently.";
  private statusTone: "info" | "success" | "error" = "info";
  private pendingFocus: FocusSnapshot | null = null;
  private fieldRegistry: EditorFieldRegistry | null = null;
  private lastNotifiedDataJson: string;

  constructor(options: WebKeyframesEditorOptions) {
    if (!isEditorMountRoot(options.root)) {
      throw new Error("root must be an HTMLElement or ShadowRoot.");
    }

    this.root = options.root;
    this.initialData = options.initialData ?? DEFAULT_EDITOR_DATA;
    this.data = this.initialData;
    this.onDataChange = options.onDataChange ?? null;
    this.lastNotifiedDataJson = JSON.stringify(this.initialData);
    this.lifecycleController = new EditorLifecycleController({
      root: this.root,
      createContainer: (ownerDocument) => createEditorContainer(ownerDocument),
      isVisible: (container) => isEditorVisible(container),
      setVisible: (container, isVisible) => setEditorVisibility(container, isVisible),
      hasOpenPreview: () => this.previewController.hasOpenPreviewPanel(),
      closePreview: () => this.previewController.closePreview("Closed preview."),
      toggleEditor: () => this.toggle(),
    });
    this.dragController = new EditorDragController({
      getContainer: () => this.lifecycleController.getContainer(),
      getOwnerWindow: () => this.root.ownerDocument.defaultView,
    });
    this.dataController = new EditorDataController({
      defaultTimelineData: DEFAULT_TIMELINE_DATA,
      getData: () => this.data,
      setData: (data) => {
        this.data = data;
      },
      getSelectedTimelineIndex: () => this.selectedTimelineIndex,
      setSelectedTimelineIndex: (index) => {
        this.selectedTimelineIndex = index;
      },
      getSelectedKeyframeIndex: () => this.selectedKeyframeIndex,
      setSelectedKeyframeIndex: (index) => {
        this.selectedKeyframeIndex = index;
      },
      getLastNotifiedDataJson: () => this.lastNotifiedDataJson,
      setLastNotifiedDataJson: (value) => {
        this.lastNotifiedDataJson = value;
      },
      onDataChange: this.onDataChange,
    });
    this.dataController.setData(this.initialData);
    this.inputController = new EditorInputController({
      getFieldRegistry: () => this.fieldRegistry,
      setPendingFocus: (snapshot) => {
        this.pendingFocus = snapshot;
      },
      renderWithStatus: (tone, message) => this.renderWithStatus(tone, message),
      setStatus: (tone, message) => this.setStatus(tone, message),
    });
    this.stateController = new EditorStateController({
      getData: () => this.data,
      getSelectedTimelineIndex: () => this.selectedTimelineIndex,
      setSelectedTimelineIndex: (index) => {
        this.selectedTimelineIndex = index;
      },
      getSelectedKeyframeIndex: () => this.selectedKeyframeIndex,
      setSelectedKeyframeIndex: (index) => {
        this.selectedKeyframeIndex = index;
      },
      normalizeEditorState: () => this.dataController.normalizeState(),
      render: () => this.render(),
      setStatus: (tone, message) => this.setStatus(tone, message),
    });
    this.collectionController = new EditorCollectionController({
      defaultTimelineData: DEFAULT_TIMELINE_DATA,
      getData: () => this.data,
      setData: (data) => {
        this.data = data;
      },
      getSelectedTimelineIndex: () => this.selectedTimelineIndex,
      setSelectedTimelineIndex: (index) => {
        this.selectedTimelineIndex = index;
      },
      getSelectedKeyframeIndex: () => this.selectedKeyframeIndex,
      setSelectedKeyframeIndex: (index) => {
        this.selectedKeyframeIndex = index;
      },
      normalizeEditorState: () => this.dataController.normalizeState(),
      render: () => this.render(),
      renderWithStatus: (tone, message) => this.renderWithStatus(tone, message),
      stateController: this.stateController,
    });
    this.keyframePropertyController = new EditorKeyframePropertyController({
      getSelectedKeyframeIndex: () => this.selectedKeyframeIndex,
      stateController: this.stateController,
      inputController: this.inputController,
    });
    this.previewController = new EditorPreviewController({
      getOwnerDocument: () => this.root.ownerDocument,
      getJsonText: () => this.toJson(),
      getCssText: () => this.toCss(),
      getSelectedTimeline: () => this.getSelectedTimeline(),
      setStatus: (tone, message) => this.setStatus(tone, message),
      render: () => this.render(),
    });
    this.sectionInputController = new EditorSectionInputController({
      defaultTimelineData: DEFAULT_TIMELINE_DATA,
      getSelectedKeyframeIndex: () => this.selectedKeyframeIndex,
      setSelectedKeyframeIndex: (index) => {
        this.selectedKeyframeIndex = index;
      },
      inputController: this.inputController,
      stateController: this.stateController,
      setStatus: (tone, message) => this.setStatus(tone, message),
      render: () => this.render(),
      renderWithStatus: (tone, message) => this.renderWithStatus(tone, message),
    });
    this.lifecycleController.setShortcut(options.shortcut);
    this.editorChromeActions = {
      hide: () => this.hide(),
      reset: () => this.reset(),
    };
    this.timelineActions = {
      "select-timeline": (payload) => {
        this.selectedTimelineIndex = selectTimelineIndex(this.data, payload?.index ?? 0);
        this.dataController.normalizeState();
        this.render();
      },
      "add-timeline": () => this.collectionController.addTimeline(),
      "duplicate-timeline": () => this.collectionController.duplicateTimeline(),
      "delete-timeline": () => this.collectionController.deleteTimeline(),
    };
    this.keyframeActions = {
      "select-keyframe": (payload) => {
        this.selectedKeyframeIndex = selectKeyframeIndex(this.getSelectedTimeline(), payload?.index ?? 0);
        this.render();
      },
      "set-timing-function": (payload) => this.keyframePropertyController.setTimingFunctionPreset(payload?.value ?? ""),
      "clear-timing-function": () => this.keyframePropertyController.clearTimingFunction(),
      "move-transform-up": (payload) => this.keyframePropertyController.moveSelectedTransform(payload?.index ?? 0, -1),
      "move-transform-down": (payload) => this.keyframePropertyController.moveSelectedTransform(payload?.index ?? 0, 1),
      "delete-transform": (payload) => this.keyframePropertyController.deleteSelectedTransform(payload?.index ?? 0),
      "add-transform": (payload) => this.keyframePropertyController.addSelectedTransform((payload?.kind ?? "translate") as TransformKind),
      "add-opacity": () => this.keyframePropertyController.addOpacityProperty(),
      "delete-opacity": () => this.keyframePropertyController.deleteOpacityProperty(),
      "delete-transforms": () => this.keyframePropertyController.deleteTransformProperty(),
      "clear-transforms": () => this.keyframePropertyController.clearTransformProperty(),
      "add-keyframe": () => this.collectionController.addKeyframe(),
      "delete-keyframe": () => this.collectionController.deleteKeyframe(),
      "duplicate-keyframe": () => this.collectionController.duplicateKeyframe(),
    };
    this.previewActions = {
      "copy-json": () => {
        void this.previewController.copyPayload("json");
      },
      "copy-css": () => {
        void this.previewController.copyPayload("css");
      },
      "run-preview": () => this.previewController.runPreview(),
      "reset-preview": () => this.previewController.resetAppliedPreview(),
      "view-json": () => this.previewController.openGeneratedPreview("json"),
      "view-css": () => this.previewController.openGeneratedPreview("css"),
      "close-preview": () => this.previewController.closePreview("Closed preview."),
    };
  }

  mount(): void {
    this.lifecycleController.mount(() => this.render());
  }

  unmount(): void {
    this.lifecycleController.unmount(() => {
      this.previewController.clearState();
      this.dragController.stop();
      this.fieldRegistry = null;
    });
  }

  show(): void {
    this.lifecycleController.show();
  }

  hide(): void {
    this.lifecycleController.hide();
  }

  toggle(): void {
    this.lifecycleController.toggle();
  }

  setShortcut(shortcut: string | false | undefined): void {
    this.lifecycleController.setShortcut(shortcut);
  }

  getData(): WebKeyframesDocument {
    return this.dataController.getData();
  }

  setData(data: WebKeyframesDocument): void {
    this.dataController.setData(data);
    this.dataController.notifyDataChangeIfNeeded();
    if (this.lifecycleController.getContainer() !== null) {
      this.render();
    }
  }

  toJson(): string {
    return this.dataController.getJson();
  }

  toCss(): string {
    return this.dataController.getCss();
  }

  private render(): void {
    const container = this.lifecycleController.getContainer();
    if (container === null) {
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

    const { panel, fieldRegistry } = renderEditorPanel(
      this.root.ownerDocument,
      renderState,
      {
        previewContent: this.previewController.getPreviewPanel().content,
        previewTitle: this.previewController.getPreviewPanel().title,
        selectedKeyframeIndex: this.selectedKeyframeIndex,
        selectedTimelineIndex: this.selectedTimelineIndex,
        statusMessage: this.statusMessage,
        statusTone: this.statusTone,
      },
      {
        onAction: (action, payload) => this.handleAction(action, payload),
        onDurationInput: (input, eventType) => this.sectionInputController.handleDurationInput(input, eventType),
        onKeyframePositionInput: (input, eventType) => this.sectionInputController.handleKeyframePositionInput(input, eventType),
        onOpacityInput: (input, eventType) => this.sectionInputController.handleOpacityInput(input, eventType),
        onPositionTypeChange: (select) => this.sectionInputController.handlePositionTypeChange(select),
        onTimelineIdInput: (input) => this.sectionInputController.handleTimelineIdInput(input),
        onTimingFunctionInput: (input) => this.sectionInputController.handleTimingFunctionInput(input),
        onTransformKindChange: (index, select) => this.sectionInputController.applyTransformKindChange(index, select.value),
        onTransformValueInput: (index, axis, input, eventType) =>
          this.sectionInputController.handleTransformValueInput(index, axis, input, eventType),
        onTranslateCustomUnitInput: (input) => this.sectionInputController.handleTranslateCustomUnitInput(input),
        onTranslateUnitChange: (select) => this.sectionInputController.handleTranslateUnitChange(select),
      },
    );
    this.fieldRegistry = fieldRegistry;
    container.replaceChildren(panel);
    this.dragController.bindHandles();
    this.dragController.applyPosition();
    this.dataController.notifyDataChangeIfNeeded();
    queueMicrotask(() => this.restoreFocus());
  }

  private handleAction(action: string, payload?: EditorActionPayload): void {
    const handler = this.editorChromeActions[action]
      ?? this.timelineActions[action]
      ?? this.keyframeActions[action]
      ?? this.previewActions[action];
    if (!handler) {
      return;
    }

    handler(payload);
  }

  private setStatus(tone: "info" | "success" | "error", message: string): void {
    this.statusTone = tone;
    this.statusMessage = message;
  }

  private renderWithStatus(tone: "info" | "success" | "error", message: string): void {
    this.setStatus(tone, message);
    this.render();
  }

  private reset(): void {
    this.previewController.clearState();
    this.dataController.resetData(this.initialData);
    this.setStatus("success", "Reset editor data to the initial state.");
    this.render();
  }

  private restoreFocus(): void {
    this.pendingFocus = restoreFocusSnapshot(this.fieldRegistry, this.pendingFocus);
  }

  private getSelectedTimeline(): WebKeyframesTimeline {
    return this.dataController.getSelectedTimeline();
  }
}

function isEditorMountRoot(value: unknown): value is HTMLElement | ShadowRoot {
  return typeof value === "object"
    && value !== null
    && "ownerDocument" in value
    && "append" in value;
}
