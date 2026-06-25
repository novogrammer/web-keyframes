type StatusTone = "info" | "success" | "error";

type InputControllerContext = {
  capturePendingFocus: (field: string, input: HTMLInputElement | HTMLSelectElement) => void;
  renderWithStatus: (tone: StatusTone, message: string) => void;
  setStatus: (tone: StatusTone, message: string) => void;
  syncLinkedNumberFields: (field: string, value: number, source: HTMLInputElement) => void;
};

export function commitTextInput(
  context: InputControllerContext,
  field: string,
  input: HTMLInputElement | HTMLSelectElement,
  update: () => void,
): void {
  context.capturePendingFocus(field, input);
  update();
  context.renderWithStatus("info", "Editing timeline data.");
}

export function commitNumberInput(
  context: InputControllerContext,
  field: string,
  input: HTMLInputElement,
  update: (value: number) => void,
): void {
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    return;
  }

  context.capturePendingFocus(field, input);
  update(value);
}

export function handleBoundedNumberInput(
  context: InputControllerContext,
  field: string,
  input: HTMLInputElement,
  eventType: "input" | "change",
  update: (value: number) => void,
): void {
  if (input.type === "range") {
    if (eventType !== "input" && eventType !== "change") {
      return;
    }

    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }

    if (eventType === "input") {
      update(value);
      context.syncLinkedNumberFields(field, value, input);
      context.setStatus("info", "Editing timeline data.");
      return;
    }

    commitNumberInput(context, field, input, (nextValue) => update(nextValue));
    context.renderWithStatus("info", "Editing timeline data.");
    return;
  }

  if (input.type === "number" && eventType === "change") {
    commitNumberInput(context, field, input, (nextValue) => update(nextValue));
    context.renderWithStatus("info", "Editing timeline data.");
  }
}
