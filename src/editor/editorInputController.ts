import {
  captureFocusSnapshot,
  syncNumberFieldValues,
  type FocusSnapshot,
} from "./editorInteraction.js";
import {
  commitNumberInput as commitNumberFieldInput,
  commitTextInput as commitTextFieldInput,
  handleBoundedNumberInput as handleBoundedEditorNumberInput,
} from "./editorInputHandlers.js";
import type { EditorFieldRegistry } from "./editorViewTypes.js";

type StatusTone = "info" | "success" | "error";

type EditorInputControllerOptions = {
  getFieldRegistry: () => EditorFieldRegistry | null;
  setPendingFocus: (snapshot: FocusSnapshot | null) => void;
  renderWithStatus: (tone: StatusTone, message: string) => void;
  setStatus: (tone: StatusTone, message: string) => void;
};

export class EditorInputController {
  private readonly getFieldRegistry: () => EditorFieldRegistry | null;
  private readonly setPendingFocusState: (snapshot: FocusSnapshot | null) => void;
  private readonly renderWithStatusState: (tone: StatusTone, message: string) => void;
  private readonly setStatusState: (tone: StatusTone, message: string) => void;

  constructor(options: EditorInputControllerOptions) {
    this.getFieldRegistry = options.getFieldRegistry;
    this.setPendingFocusState = options.setPendingFocus;
    this.renderWithStatusState = options.renderWithStatus;
    this.setStatusState = options.setStatus;
  }

  commitTextInput(
    field: string,
    input: HTMLInputElement | HTMLSelectElement,
    update: () => void,
  ): void {
    commitTextFieldInput(this.createContext(), field, input, update);
  }

  handleBoundedNumberInput(
    field: string,
    input: HTMLInputElement,
    eventType: "input" | "change",
    update: (value: number) => void,
  ): void {
    handleBoundedEditorNumberInput(this.createContext(), field, input, eventType, update);
  }

  commitNumberInput(
    field: string,
    input: HTMLInputElement,
    update: (value: number) => void,
  ): void {
    commitNumberFieldInput(this.createContext(), field, input, update);
  }

  capturePendingFocus(field: string, input: HTMLInputElement | HTMLSelectElement): void {
    this.setPendingFocusState(captureFocusSnapshot(this.getFieldRegistry(), field, input));
  }

  setPendingFocus(snapshot: FocusSnapshot | null): void {
    this.setPendingFocusState(snapshot);
  }

  private createContext(): {
    capturePendingFocus: (field: string, input: HTMLInputElement | HTMLSelectElement) => void;
    renderWithStatus: (tone: StatusTone, message: string) => void;
    setStatus: (tone: StatusTone, message: string) => void;
    syncLinkedNumberFields: (field: string, value: number, source: HTMLInputElement) => void;
  } {
    return {
      capturePendingFocus: (field, input) => this.capturePendingFocus(field, input),
      renderWithStatus: (tone, message) => this.renderWithStatusState(tone, message),
      setStatus: (tone, message) => this.setStatusState(tone, message),
      syncLinkedNumberFields: (field, value, source) =>
        syncNumberFieldValues(this.getFieldRegistry(), field, value, source),
    };
  }
}
