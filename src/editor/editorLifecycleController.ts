import { clampNumber } from "./editorModel.js";
import type { FocusSnapshot, PanelPosition } from "./editorStateController.js";
import { setContainerVisibility } from "./editorShell.js";

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

type ShortcutDescriptor = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

type DragState = {
  pointerOffsetX: number;
  pointerOffsetY: number;
};

export function createEditorLifecycleController(
  root: HTMLElement,
  options: {
    shortcut: string | false | undefined;
    onToggle: () => void;
    onEscape: () => void;
    onClick: (event: MouseEvent) => void;
    onInput: (event: Event) => void;
    onChange: (event: Event) => void;
  },
): {
  mount: (container: HTMLElement) => void;
  unmount: (container: HTMLElement | null) => void;
  show: (container: HTMLElement) => void;
  hide: (container: HTMLElement) => void;
  toggle: (container: HTMLElement) => void;
  bindDragging: (
    container: HTMLElement | null,
    position: PanelPosition | null,
    setPosition: (position: PanelPosition | null) => void,
  ) => void;
  restoreFocus: (container: HTMLElement | null, pendingFocus: FocusSnapshot | null, clearPendingFocus: () => void) => void;
  captureFocusSnapshot: (
    container: HTMLElement | null,
    field: string,
    input: HTMLInputElement | HTMLSelectElement,
  ) => FocusSnapshot;
  syncNumberFieldValues: (
    container: HTMLElement | null,
    field: string,
    value: number,
    source: HTMLInputElement,
  ) => void;
} {
  const shortcut = parseShortcut(options.shortcut);
  let dragState: DragState | null = null;
  let mountedContainer: HTMLElement | null = null;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      options.onEscape();
      return;
    }

    if (shortcut !== null && matchesShortcut(event, shortcut)) {
      event.preventDefault();
      options.onToggle();
    }
  };
  const handleDragMove = (event: MouseEvent) => {
    if (dragState === null || mountedContainer === null) {
      return;
    }

    const panel = mountedContainer.querySelector<HTMLElement>(".wkf__panel");
    const ownerWindow = root.ownerDocument.defaultView;
    if (!panel || !ownerWindow) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const minLeft = Math.min(0, PANEL_MIN_VISIBLE_X - rect.width);
    const maxLeft = Math.max(0, ownerWindow.innerWidth - PANEL_MIN_VISIBLE_X);
    const minTop = Math.min(0, PANEL_MIN_VISIBLE_Y - rect.height);
    const maxTop = Math.max(0, ownerWindow.innerHeight - PANEL_MIN_VISIBLE_Y);

    const nextPosition = {
      left: clampNumber(event.clientX - dragState.pointerOffsetX, minLeft, maxLeft),
      top: clampNumber(event.clientY - dragState.pointerOffsetY, minTop, maxTop),
    };
    applyPanelPosition(mountedContainer, nextPosition);
  };
  const handleDragEnd = () => {
    const ownerWindow = root.ownerDocument.defaultView;
    if (ownerWindow) {
      ownerWindow.removeEventListener("mousemove", handleDragMove);
      ownerWindow.removeEventListener("mouseup", handleDragEnd);
    }
    mountedContainer?.querySelector<HTMLElement>(".wkf__panel")?.classList.remove("wkf__panel--dragging");
    dragState = null;
  };

  return {
    mount: (container) => {
      mountedContainer = container;
      container.addEventListener("click", options.onClick);
      container.addEventListener("input", options.onInput);
      container.addEventListener("change", options.onChange);
      root.ownerDocument.addEventListener("keydown", handleKeydown);
    },
    unmount: (container) => {
      root.ownerDocument.removeEventListener("keydown", handleKeydown);
      container?.removeEventListener("click", options.onClick);
      container?.removeEventListener("input", options.onInput);
      container?.removeEventListener("change", options.onChange);
      handleDragEnd();
      mountedContainer = null;
    },
    show: (container) => {
      setContainerVisibility(container, true);
    },
    hide: (container) => {
      setContainerVisibility(container, false);
    },
    toggle: (container) => {
      setContainerVisibility(container, !container.classList.contains("wkf--visible"));
    },
    bindDragging: (container, position, setPosition) => {
      const handles = container?.querySelectorAll<HTMLElement>("[data-wkf-drag-handle='true']");
      if (!handles || handles.length === 0) {
        return;
      }

      handles.forEach((handle) => {
        handle.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }

          const target = event.target;
          if (
            target instanceof Element &&
            target.closest("[data-wkf-no-drag='true'], button, input, select, textarea, label")
          ) {
            return;
          }

          const panel = container?.querySelector<HTMLElement>(".wkf__panel");
          const ownerWindow = root.ownerDocument.defaultView;
          if (!panel || !ownerWindow) {
            return;
          }

          const rect = panel.getBoundingClientRect();
          setPosition({ left: rect.left, top: rect.top });
          dragState = {
            pointerOffsetX: event.clientX - rect.left,
            pointerOffsetY: event.clientY - rect.top,
          };
          mountedContainer = container;

          panel.classList.add("wkf__panel--dragging");
          ownerWindow.addEventListener("mousemove", handleDragMove);
          ownerWindow.addEventListener("mouseup", handleDragEnd);
          event.preventDefault();
        });
      });

      applyPanelPosition(container, position);
    },
    restoreFocus: (container, pendingFocus, clearPendingFocus) => {
      if (container === null || pendingFocus === null) {
        return;
      }

      const selector = `[data-wkf-field='${pendingFocus.field}']`;
      const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector);
      const input = inputs[pendingFocus.index];
      if (!input) {
        clearPendingFocus();
        return;
      }

      input.focus();
      if (
        input instanceof HTMLInputElement &&
        pendingFocus.selectionStart !== null &&
        pendingFocus.selectionEnd !== null &&
        typeof input.setSelectionRange === "function"
      ) {
        input.setSelectionRange(pendingFocus.selectionStart, pendingFocus.selectionEnd);
      }

      clearPendingFocus();
    },
    captureFocusSnapshot: (container, field, input) => {
      const inputs = container?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-wkf-field='${field}']`) ?? [];
      const index = Math.max(0, Array.from(inputs).indexOf(input));

      return {
        field,
        index,
        selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
        selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
      };
    },
    syncNumberFieldValues: (container, field, value, source) => {
      container?.querySelectorAll<HTMLInputElement>(`[data-wkf-field='${field}']`).forEach((input) => {
        if (input === source) {
          return;
        }

        input.value = String(value);
      });
    },
  };
}

function applyPanelPosition(container: HTMLElement | null, position: PanelPosition | null): void {
  const panel = container?.querySelector<HTMLElement>(".wkf__panel");
  if (!panel) {
    return;
  }

  if (position === null) {
    panel.style.left = "";
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.transform = "";
    return;
  }

  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.bottom = "auto";
  panel.style.transform = "none";
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
