type ShortcutDescriptor = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

type EditorLifecycleControllerOptions = {
  root: HTMLElement | ShadowRoot;
  createContainer: (ownerDocument: Document) => HTMLElement;
  isVisible: (container: HTMLElement) => boolean;
  setVisible: (container: HTMLElement, isVisible: boolean) => void;
  hasOpenPreview: () => boolean;
  closePreview: () => void;
  toggleEditor: () => void;
};

export class EditorLifecycleController {
  private readonly root: HTMLElement | ShadowRoot;
  private readonly createContainerState: (ownerDocument: Document) => HTMLElement;
  private readonly isVisibleState: (container: HTMLElement) => boolean;
  private readonly setVisibleState: (container: HTMLElement, isVisible: boolean) => void;
  private readonly hasOpenPreviewState: () => boolean;
  private readonly closePreviewState: () => void;
  private readonly toggleEditorState: () => void;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private shortcut: ShortcutDescriptor | null = null;
  private container: HTMLElement | null = null;
  private mounted = false;

  constructor(options: EditorLifecycleControllerOptions) {
    this.root = options.root;
    this.createContainerState = options.createContainer;
    this.isVisibleState = options.isVisible;
    this.setVisibleState = options.setVisible;
    this.hasOpenPreviewState = options.hasOpenPreview;
    this.closePreviewState = options.closePreview;
    this.toggleEditorState = options.toggleEditor;
    this.handleKeydown = (event) => {
      if (event.key === "Escape" && this.hasOpenPreviewState()) {
        event.preventDefault();
        this.closePreviewState();
        return;
      }

      if (this.shortcut !== null && matchesShortcut(event, this.shortcut)) {
        event.preventDefault();
        this.toggleEditorState();
      }
    };
  }

  getContainer(): HTMLElement | null {
    return this.container;
  }

  isMounted(): boolean {
    return this.mounted;
  }

  mount(render: () => void): void {
    if (this.mounted) {
      throw new Error("mount() has already been called.");
    }

    const ownerDocument = this.root.ownerDocument;
    const container = this.createContainerState(ownerDocument);
    this.container = container;
    render();
    this.root.append(container);
    ownerDocument.addEventListener("keydown", this.handleKeydown);
    this.mounted = true;
  }

  unmount(beforeUnmount: () => void): void {
    if (!this.mounted) {
      return;
    }

    beforeUnmount();
    this.root.ownerDocument.removeEventListener("keydown", this.handleKeydown);
    this.container?.remove();
    this.container = null;
    this.mounted = false;
  }

  show(): void {
    this.ensureMounted();
    this.setVisibleState(this.container!, true);
  }

  hide(): void {
    this.ensureMounted();
    this.setVisibleState(this.container!, false);
  }

  toggle(): void {
    this.ensureMounted();
    if (this.isVisibleState(this.container!)) {
      this.hide();
      return;
    }

    this.show();
  }

  setShortcut(shortcut: string | false | undefined): void {
    this.shortcut = parseShortcut(shortcut);
  }

  private ensureMounted(): void {
    if (!this.mounted || this.container === null) {
      throw new Error("Editor is not mounted.");
    }
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
