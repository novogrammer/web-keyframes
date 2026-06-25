import type { WebKeyframesTimeline } from "../core/types.js";
import {
  clearAppliedPreview,
  closePreviewPanel,
  copyGeneratedPayload,
  createEmptyPreviewPanelState,
  type ActivePreview,
  openGeneratedPreviewPanel,
  type PreviewPanelState,
  resetTimelinePreview,
  runTimelinePreview,
} from "./editorPreview.js";

type StatusTone = "info" | "success" | "error";

type EditorPreviewControllerOptions = {
  getOwnerDocument: () => Document;
  getJsonText: () => string;
  getCssText: () => string;
  getSelectedTimeline: () => WebKeyframesTimeline;
  setStatus: (tone: StatusTone, message: string) => void;
  render: () => void;
};

export class EditorPreviewController {
  private readonly getOwnerDocumentState: () => Document;
  private readonly getJsonTextState: () => string;
  private readonly getCssTextState: () => string;
  private readonly getSelectedTimelineState: () => WebKeyframesTimeline;
  private readonly setStatusState: (tone: StatusTone, message: string) => void;
  private readonly renderState: () => void;
  private previewPanel: PreviewPanelState = createEmptyPreviewPanelState();
  private activePreview: ActivePreview | null = null;

  constructor(options: EditorPreviewControllerOptions) {
    this.getOwnerDocumentState = options.getOwnerDocument;
    this.getJsonTextState = options.getJsonText;
    this.getCssTextState = options.getCssText;
    this.getSelectedTimelineState = options.getSelectedTimeline;
    this.setStatusState = options.setStatus;
    this.renderState = options.render;
  }

  getPreviewPanel(): PreviewPanelState {
    return this.previewPanel;
  }

  hasOpenPreviewPanel(): boolean {
    return this.previewPanel.title !== null;
  }

  clearState(): void {
    this.clearActivePreview();
    this.previewPanel = createEmptyPreviewPanelState();
  }

  async copyPayload(kind: "json" | "css"): Promise<void> {
    try {
      const text = kind === "json" ? this.getJsonTextState() : this.getCssTextState();
      const status = await copyGeneratedPayload(this.getOwnerDocumentState().defaultView, kind, text);
      this.setStatusState(status.tone, status.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatusState("error", message);
    }

    this.renderState();
  }

  openGeneratedPreview(kind: "json" | "css"): void {
    try {
      const nextState = openGeneratedPreviewPanel(kind, this.getJsonTextState(), this.getCssTextState());
      this.previewPanel = nextState.previewPanel;
      this.setStatusState(nextState.status.tone, nextState.status.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.previewPanel = createEmptyPreviewPanelState();
      this.setStatusState("error", message);
    }

    this.renderState();
  }

  closePreview(message: string): void {
    const nextState = closePreviewPanel(message);
    this.previewPanel = nextState.previewPanel;
    this.setStatusState(nextState.status.tone, nextState.status.message);
    this.renderState();
  }

  runPreview(): void {
    try {
      const nextState = runTimelinePreview(
        this.getOwnerDocumentState(),
        this.getSelectedTimelineState(),
        this.activePreview,
      );
      this.activePreview = nextState.activePreview;
      this.setStatusState(nextState.status.tone, nextState.status.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatusState("error", message);
    }

    this.renderState();
  }

  resetAppliedPreview(): void {
    const nextState = resetTimelinePreview(this.activePreview);
    this.activePreview = nextState.activePreview;
    this.setStatusState(nextState.status.tone, nextState.status.message);
    this.renderState();
  }

  private clearActivePreview(): void {
    clearAppliedPreview(this.activePreview);
    this.activePreview = null;
  }
}
