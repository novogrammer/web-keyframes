import type {
  EditorFieldElement,
  EditorFieldRegistry,
  EditorViewHandlers,
} from "./editorViewTypes.js";

const TIMING_FUNCTION_PRESETS = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "step-start",
  "step-end",
  "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "steps(4, end)",
] as const;

export function renderTextField(
  ownerDocument: Document,
  label: string,
  value: string,
  onInput: (input: HTMLInputElement) => void,
  fieldRegistry: EditorFieldRegistry,
  testField?: string,
): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(
    createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }),
  );
  const input = createElement(ownerDocument, "input", {
    className: "wkf__input",
    dataset: testField ? { wkfField: testField } : undefined,
  }) as HTMLInputElement;
  input.type = "text";
  input.value = value;
  registerField(fieldRegistry, testField, input);
  input.addEventListener("input", () => onInput(input));
  fieldElement.append(input);
  return fieldElement;
}

export function renderSelectField(
  ownerDocument: Document,
  label: string,
  value: string,
  options: Array<{ label: string; value: string }>,
  onChange: (select: HTMLSelectElement) => void,
  fieldRegistry: EditorFieldRegistry,
  testField?: string,
): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const select = createElement(ownerDocument, "select", {
    className: "wkf__input",
    dataset: testField ? { wkfField: testField } : undefined,
  }) as HTMLSelectElement;
  options.forEach((option) => {
    const optionElement = createElement(ownerDocument, "option") as HTMLOptionElement;
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === value;
    select.append(optionElement);
  });
  registerField(fieldRegistry, testField, select);
  select.addEventListener("change", () => onChange(select));
  fieldElement.append(select);
  return fieldElement;
}

export function renderNumberField(
  ownerDocument: Document,
  label: string,
  value: number,
  min?: number,
  step?: number,
  max?: number,
  onInput?: (input: HTMLInputElement, eventType: "input" | "change") => void,
  fieldRegistry?: EditorFieldRegistry,
  testField?: string,
): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const input = createNumericInput(ownerDocument, value, min, step, max, onInput, fieldRegistry, testField);
  fieldElement.append(input);
  return fieldElement;
}

export function renderBoundedNumberField(
  ownerDocument: Document,
  label: string,
  value: number,
  min: number,
  step: number,
  max: number,
  onInput: (input: HTMLInputElement, eventType: "input" | "change") => void,
  fieldRegistry: EditorFieldRegistry,
  testField?: string,
): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--full");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const row = createElement(ownerDocument, "div", { className: "wkf__time-row" });
  const range = createNumericInput(ownerDocument, value, min, step, max, onInput, fieldRegistry, testField);
  range.className = "wkf__range";
  range.type = "range";
  row.append(range, createNumericInput(ownerDocument, value, min, step, max, onInput, fieldRegistry, testField));
  fieldElement.append(row);
  return fieldElement;
}

export function renderRangeField(
  ownerDocument: Document,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  suffix = "",
  onInput: (input: HTMLInputElement, eventType: "input" | "change") => void,
  fieldRegistry: EditorFieldRegistry,
  testField?: string,
): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--time");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const row = createElement(ownerDocument, "div", { className: "wkf__time-row" });
  const range = createNumericInput(ownerDocument, value, min, step, max, onInput, fieldRegistry, testField);
  range.className = "wkf__range";
  range.type = "range";
  row.append(range, createNumericInput(ownerDocument, value, min, step, max, onInput, fieldRegistry, testField));
  fieldElement.append(row);
  if (suffix !== "") {
    fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__subtitle", textContent: suffix }));
  }
  return fieldElement;
}

export function renderTimingFunctionPresets(ownerDocument: Document, handlers: EditorViewHandlers): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--full");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: "Insert Preset" }));
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  TIMING_FUNCTION_PRESETS.forEach((value) => {
    actions.append(createButton(ownerDocument, value, {
      action: "set-timing-function",
      small: true,
      ghost: true,
      dataset: { wkfValue: value },
    }, handlers));
  });
  actions.append(createButton(ownerDocument, "Clear", { action: "clear-timing-function", small: true, ghost: true }, handlers));
  fieldElement.append(actions);
  return fieldElement;
}

export function createSectionHead(ownerDocument: Document, title: string): HTMLElement {
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  head.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: title }));
  return head;
}

export function createField(ownerDocument: Document, className = "wkf__field"): HTMLElement {
  return createElement(ownerDocument, "label", { className });
}

export function createButton(
  ownerDocument: Document,
  textContent: string,
  options: {
    action: string;
    className?: string;
    dataset?: Record<string, string>;
    disabled?: boolean;
    ghost?: boolean;
    kind?: string;
    small?: boolean;
  },
  handlers: EditorViewHandlers,
): HTMLButtonElement {
  const button = createElement(ownerDocument, "button", {
    className: options.className ?? [
      "wkf__button",
      options.small ? "wkf__button--small" : "",
      options.ghost ? "wkf__button--ghost" : "",
    ].filter(Boolean).join(" "),
    dataset: {
      wkfAction: options.action,
      ...(options.dataset ?? {}),
      ...(options.kind ? { wkfKind: options.kind } : {}),
    },
    textContent,
  }) as HTMLButtonElement;
  button.type = "button";
  button.disabled = options.disabled ?? false;
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }
    handlers.onAction(options.action, {
      index: options.dataset?.wkfIndex !== undefined ? Number(options.dataset.wkfIndex) : undefined,
      kind: options.kind,
      value: options.dataset?.wkfValue,
    });
  });
  return button;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  ownerDocument: Document,
  tagName: K,
  options: {
    className?: string;
    dataset?: Record<string, string>;
    textContent?: string;
  } = {},
): HTMLElementTagNameMap[K] {
  const element = ownerDocument.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  if (options.textContent !== undefined) {
    element.textContent = options.textContent;
  }
  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      element.dataset[key] = value;
    }
  }
  return element;
}

function createNumericInput(
  ownerDocument: Document,
  value: number,
  min?: number,
  step?: number,
  max?: number,
  onInput?: (input: HTMLInputElement, eventType: "input" | "change") => void,
  fieldRegistry?: EditorFieldRegistry,
  testField?: string,
): HTMLInputElement {
  const input = createElement(ownerDocument, "input", {
    className: "wkf__input",
    dataset: testField ? { wkfField: testField } : undefined,
  }) as HTMLInputElement;
  input.type = "number";
  input.value = String(value);
  if (min !== undefined) {
    input.min = String(min);
  }
  if (max !== undefined) {
    input.max = String(max);
  }
  if (step !== undefined) {
    input.step = String(step);
  }
  if (fieldRegistry) {
    registerField(fieldRegistry, testField, input);
  }
  if (onInput) {
    input.addEventListener("change", () => onInput(input, "change"));
    input.addEventListener("input", () => onInput(input, "input"));
  }
  return input;
}

function registerField(
  fieldRegistry: EditorFieldRegistry,
  field: string | undefined,
  element: EditorFieldElement,
): void {
  if (!field) {
    return;
  }

  const elements = fieldRegistry.get(field);
  if (elements) {
    elements.push(element);
    return;
  }

  fieldRegistry.set(field, [element]);
}
