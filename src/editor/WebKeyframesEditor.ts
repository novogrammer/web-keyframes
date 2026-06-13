import {
  DEFAULT_UNIT_FUNCTION,
  generateScss,
  normalizeWebKeyframesData,
  validateWebKeyframesData,
} from "../core/index.js";
import type { WebKeyframesData } from "../core/index.js";

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
  unitFunction: DEFAULT_UNIT_FUNCTION,
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

export class WebKeyframesEditor {
  private readonly root: HTMLElement;
  private readonly shortcut: ShortcutDescriptor | null;
  private readonly handleKeydown: (event: KeyboardEvent) => void;
  private container: HTMLElement | null = null;
  private mounted = false;
  private data: WebKeyframesData;

  constructor(options: WebKeyframesEditorOptions) {
    if (!(options.root instanceof HTMLElement)) {
      throw new Error("root must be an HTMLElement.");
    }

    this.root = options.root;
    this.data = cloneData(options.initialData ?? DEFAULT_EDITOR_DATA);
    validateWebKeyframesData(this.data);
    this.shortcut = parseShortcut(options.shortcut);
    this.handleKeydown = (event) => {
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

    if (this.shortcut !== null) {
      ownerDocument.addEventListener("keydown", this.handleKeydown);
    }

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
    this.data = cloneData(validateWebKeyframesData(data));
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

    const normalized = normalizeWebKeyframesData(this.data);
    const summary = [
      { label: "ID", value: normalized.id },
      { label: "Target", value: normalized.target },
      { label: "Duration", value: `${normalized.duration}ms` },
      { label: "Design Width", value: String(normalized.designWidth) },
      { label: "Unit Function", value: normalized.unitFunction },
      { label: "Keyframes", value: String(normalized.keyframes.length) },
    ];

    this.container.innerHTML = `
      <div class="__wkf-panel">
        <div class="__wkf-header">
          <div>
            <p class="__wkf-kicker">web-keyframes editor</p>
            <h2 class="__wkf-title">Mounted</h2>
          </div>
          <button type="button" class="__wkf-button" data-wkf-action="hide">Hide</button>
        </div>
        <div class="__wkf-grid">
          ${summary
            .map(
              (item) => `
                <div class="__wkf-field">
                  <div class="__wkf-label">${escapeHtml(item.label)}</div>
                  <div class="__wkf-value">${escapeHtml(item.value)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="__wkf-footer">
          <p class="__wkf-note">Editing UI and clipboard actions will be added next. Core data APIs are already available.</p>
        </div>
      </div>
    `;

    const hideButton = this.container.querySelector<HTMLElement>("[data-wkf-action='hide']");
    hideButton?.addEventListener("click", () => {
      this.hide();
    });
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
    keyframes: data.keyframes.map((keyframe) => ({ ...keyframe })),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
