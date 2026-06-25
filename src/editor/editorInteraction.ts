import type { EditorFieldRegistry } from "./editorViewTypes.js";

export type FocusSnapshot = {
  field: string;
  index: number;
  selectionStart: number | null;
  selectionEnd: number | null;
};

type PanelPosition = {
  left: number;
  top: number;
};

type DragState = {
  pointerOffsetX: number;
  pointerOffsetY: number;
};

const PANEL_MIN_VISIBLE_X = 72;
const PANEL_MIN_VISIBLE_Y = 56;

export type EditorDragSession = {
  dragState: DragState;
  panelPosition: PanelPosition;
};

export function captureFocusSnapshot(
  fieldRegistry: EditorFieldRegistry | null,
  field: string,
  input: HTMLInputElement | HTMLSelectElement,
): FocusSnapshot {
  const inputs = fieldRegistry?.get(field) ?? [];
  const index = Math.max(0, inputs.indexOf(input));

  return {
    field,
    index,
    selectionStart: input instanceof HTMLInputElement ? input.selectionStart : null,
    selectionEnd: input instanceof HTMLInputElement ? input.selectionEnd : null,
  };
}

export function restoreFocusSnapshot(
  fieldRegistry: EditorFieldRegistry | null,
  snapshot: FocusSnapshot | null,
): FocusSnapshot | null {
  if (fieldRegistry === null || snapshot === null) {
    return snapshot;
  }

  const inputs = fieldRegistry.get(snapshot.field) ?? [];
  const input = inputs[snapshot.index];
  if (!input) {
    return null;
  }

  input.focus();
  if (
    input instanceof HTMLInputElement &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null &&
    typeof input.setSelectionRange === "function"
  ) {
    input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  }

  return null;
}

export function syncNumberFieldValues(
  fieldRegistry: EditorFieldRegistry | null,
  field: string,
  value: number,
  source: HTMLInputElement,
): void {
  const inputs = fieldRegistry?.get(field) ?? [];
  inputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input === source) {
      return;
    }

    input.value = String(value);
  });
}

export function beginPanelDrag(
  container: HTMLElement | null,
  ownerWindow: Window | null,
  event: MouseEvent,
): EditorDragSession | null {
  if (event.button !== 0) {
    return null;
  }

  const target = event.target;
  if (
    target instanceof Element &&
    target.closest("[data-wkf-no-drag='true'], button, input, select, textarea, label")
  ) {
    return null;
  }

  const panel = container?.querySelector<HTMLElement>(".wkf__panel");
  if (!panel || !ownerWindow) {
    return null;
  }

  const rect = panel.getBoundingClientRect();
  panel.classList.add("wkf__panel--dragging");
  event.preventDefault();

  return {
    dragState: {
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
    },
    panelPosition: {
      left: rect.left,
      top: rect.top,
    },
  };
}

export function updatePanelDrag(
  container: HTMLElement | null,
  ownerWindow: Window | null,
  dragState: DragState | null,
  event: MouseEvent,
): PanelPosition | null {
  if (dragState === null || container === null || ownerWindow === null) {
    return null;
  }

  const panel = container.querySelector<HTMLElement>(".wkf__panel");
  if (!panel) {
    return null;
  }

  const rect = panel.getBoundingClientRect();
  const minLeft = Math.min(0, PANEL_MIN_VISIBLE_X - rect.width);
  const maxLeft = Math.max(0, ownerWindow.innerWidth - PANEL_MIN_VISIBLE_X);
  const minTop = Math.min(0, PANEL_MIN_VISIBLE_Y - rect.height);
  const maxTop = Math.max(0, ownerWindow.innerHeight - PANEL_MIN_VISIBLE_Y);
  return {
    left: clampNumber(event.clientX - dragState.pointerOffsetX, minLeft, maxLeft),
    top: clampNumber(event.clientY - dragState.pointerOffsetY, minTop, maxTop),
  };
}

export function finishPanelDrag(container: HTMLElement | null): void {
  container?.querySelector<HTMLElement>(".wkf__panel")?.classList.remove("wkf__panel--dragging");
}

export function applyPanelPosition(
  container: HTMLElement | null,
  panelPosition: PanelPosition | null,
): void {
  const panel = container?.querySelector<HTMLElement>(".wkf__panel");
  if (!panel) {
    return;
  }

  if (panelPosition === null) {
    panel.style.left = "";
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.transform = "";
    return;
  }

  panel.style.left = `${panelPosition.left}px`;
  panel.style.top = `${panelPosition.top}px`;
  panel.style.bottom = "auto";
  panel.style.transform = "none";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
