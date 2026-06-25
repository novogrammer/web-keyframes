import {
  applyPanelPosition,
  beginPanelDrag,
  finishPanelDrag,
  updatePanelDrag,
} from "./editorInteraction.js";

type PanelPosition = NonNullable<ReturnType<typeof beginPanelDrag>>["panelPosition"];
type DragState = NonNullable<ReturnType<typeof beginPanelDrag>>["dragState"];

type EditorDragControllerOptions = {
  getContainer: () => HTMLElement | null;
  getOwnerWindow: () => Window | null;
};

export class EditorDragController {
  private readonly getContainer: () => HTMLElement | null;
  private readonly getOwnerWindow: () => Window | null;
  private panelPosition: PanelPosition | null = null;
  private dragState: DragState | null = null;
  private readonly handleDragMove: (event: MouseEvent) => void;
  private readonly handleDragEnd: () => void;

  constructor(options: EditorDragControllerOptions) {
    this.getContainer = options.getContainer;
    this.getOwnerWindow = options.getOwnerWindow;
    this.handleDragMove = (event) => {
      this.updatePosition(event);
    };
    this.handleDragEnd = () => {
      this.stop();
    };
  }

  bindHandles(): void {
    const handles = this.getContainer()?.querySelectorAll<HTMLElement>("[data-wkf-drag-handle='true']");
    if (!handles || handles.length === 0) {
      return;
    }

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (event) => this.start(event));
    });
  }

  applyPosition(): void {
    applyPanelPosition(this.getContainer(), this.panelPosition);
  }

  stop(): void {
    const ownerWindow = this.getOwnerWindow();
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", this.handleDragMove);
      ownerWindow.removeEventListener("mouseup", this.handleDragEnd);
    }

    finishPanelDrag(this.getContainer());
    this.dragState = null;
  }

  private start(event: MouseEvent): void {
    const ownerWindow = this.getOwnerWindow();
    const session = beginPanelDrag(this.getContainer(), ownerWindow, event);
    if (!session || !ownerWindow) {
      return;
    }

    this.panelPosition = session.panelPosition;
    this.dragState = session.dragState;
    ownerWindow.addEventListener("mousemove", this.handleDragMove);
    ownerWindow.addEventListener("mouseup", this.handleDragEnd);
  }

  private updatePosition(event: MouseEvent): void {
    const panelPosition = updatePanelDrag(this.getContainer(), this.getOwnerWindow(), this.dragState, event);
    if (panelPosition === null) {
      return;
    }

    this.panelPosition = panelPosition;
    this.applyPosition();
  }
}
