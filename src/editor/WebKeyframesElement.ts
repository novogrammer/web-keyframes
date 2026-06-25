import { generateCss } from "../core/generateCss.js";
import { cloneDocument } from "../core/normalize.js";
import type { WebKeyframesDocument } from "../core/types.js";
import { WebKeyframesEditor } from "./WebKeyframesEditor.js";
import { EDITOR_CSS_TEXT } from "./generatedEditorCss.js";

export const WEB_KEYFRAMES_EDITOR_TAG_NAME = "web-keyframes-editor";

export type WebKeyframesEditorElementInstance = HTMLElement & {
  open: boolean;
  shortcut: string | false;
  data: WebKeyframesDocument;
  getData(): WebKeyframesDocument;
  setData(data: WebKeyframesDocument): void;
  show(): void;
  hide(): void;
  toggle(): void;
  toJson(): string;
  toCss(): string;
};

export type WebKeyframesEditorElementConstructor = {
  new (): WebKeyframesEditorElementInstance;
  readonly observedAttributes: string[];
};

function createWebKeyframesEditorElementClass(HTMLElementCtor: typeof HTMLElement): WebKeyframesEditorElementConstructor {
  return class WebKeyframesEditorElement extends HTMLElementCtor {
    static get observedAttributes(): string[] {
      return ["open", "shortcut"];
    }

    private editor: WebKeyframesEditor | null = null;
    private dataSnapshot: WebKeyframesDocument | null = null;

    connectedCallback(): void {
      if (this.editor !== null) {
        return;
      }

      const shadowRoot = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      ensureEditorStyles(shadowRoot);
      this.editor = new WebKeyframesEditor({
        root: shadowRoot,
        initialData: this.dataSnapshot ?? undefined,
        shortcut: this.shortcut,
        onDataChange: (data) => {
          this.dataSnapshot = cloneDocument(data);
          this.dispatchEvent(new CustomEvent("change", {
            bubbles: true,
            composed: true,
            detail: {
              data: cloneDocument(data),
            },
          }));
        },
      });
      this.editor.mount();
      this.dataSnapshot = this.editor.getData();

      if (this.open) {
        this.editor.show();
      }
    }

    disconnectedCallback(): void {
      if (this.editor === null) {
        return;
      }

      this.dataSnapshot = this.editor.getData();
      this.editor.unmount();
      this.editor = null;
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
      if (name === "open") {
        if (this.editor === null) {
          return;
        }

        if (newValue === null) {
          this.editor.hide();
        } else {
          this.editor.show();
        }
        return;
      }

      if (name === "shortcut") {
        this.editor?.setShortcut(this.shortcut);
      }
    }

    get open(): boolean {
      return this.hasAttribute("open");
    }

    set open(value: boolean) {
      this.toggleAttribute("open", value);
    }

    get shortcut(): string | false {
      return this.getAttribute("shortcut") ?? false;
    }

    set shortcut(value: string | false) {
      if (value === false || value === "") {
        this.removeAttribute("shortcut");
        return;
      }

      this.setAttribute("shortcut", value);
    }

    getData(): WebKeyframesDocument {
      if (this.editor !== null) {
        return this.editor.getData();
      }

      if (this.dataSnapshot !== null) {
        return cloneDocument(this.dataSnapshot);
      }

      return new WebKeyframesEditor({
        root: this.shadowRoot ?? this,
        shortcut: false,
      }).getData();
    }

    setData(data: WebKeyframesDocument): void {
      this.dataSnapshot = cloneDocument(data);
      this.editor?.setData(data);
    }

    get data(): WebKeyframesDocument {
      return this.getData();
    }

    set data(value: WebKeyframesDocument) {
      this.setData(value);
    }

    show(): void {
      this.open = true;
    }

    hide(): void {
      this.open = false;
    }

    toggle(): void {
      this.open = !this.open;
    }

    toJson(): string {
      if (this.editor !== null) {
        return this.editor.toJson();
      }

      return JSON.stringify(this.getData(), null, 2);
    }

    toCss(): string {
      if (this.editor !== null) {
        return this.editor.toCss();
      }

      return generateCss(this.getData());
    }
  };
}

const HTMLElementFallback = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export let WebKeyframesEditorElement: WebKeyframesEditorElementConstructor = createWebKeyframesEditorElementClass(HTMLElementFallback);

export function defineWebKeyframesEditorElement(
  tagName = WEB_KEYFRAMES_EDITOR_TAG_NAME,
): WebKeyframesEditorElementConstructor {
  const registry = globalThis.customElements ?? globalThis.window?.customElements;
  const HTMLElementCtor = globalThis.window?.HTMLElement ?? globalThis.HTMLElement;
  if (!registry || !HTMLElementCtor) {
    throw new Error("Custom Elements are not available in this environment.");
  }

  const existing = registry.get(tagName);
  if (existing) {
    return existing as WebKeyframesEditorElementConstructor;
  }

  WebKeyframesEditorElement = createWebKeyframesEditorElementClass(HTMLElementCtor);
  registry.define(tagName, WebKeyframesEditorElement);
  return WebKeyframesEditorElement;
}

function ensureEditorStyles(shadowRoot: ShadowRoot): void {
  if (shadowRoot.querySelector("style[data-wkf-shadow-style='true']")) {
    return;
  }

  const styleElement = shadowRoot.ownerDocument.createElement("style");
  styleElement.dataset.wkfShadowStyle = "true";
  styleElement.textContent = EDITOR_CSS_TEXT;
  shadowRoot.prepend(styleElement);
}
