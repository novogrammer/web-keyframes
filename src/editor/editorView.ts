import { formatNumber } from "../core/generateCss.js";
import {
  getOpacityValue,
  getTransformOperations,
  hasKeyframeProperty,
} from "../core/normalize.js";
import type {
  TransformOperation,
  WebKeyframe,
  WebKeyframesTimeline,
} from "../core/types.js";
import { deriveEditorRenderState } from "./editorModel.js";

export type EditorRenderState = ReturnType<typeof deriveEditorRenderState>;

export type EditorViewState = {
  previewContent: string;
  previewTitle: string | null;
  selectedKeyframeIndex: number;
  selectedTimelineIndex: number;
  statusMessage: string;
  statusTone: "info" | "success" | "error";
};

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

type EditorTimelineView = EditorRenderState["selectedTimeline"];
type EditorTranslateView = EditorTimelineView["translateConfig"];

export function renderEditorPanel(
  ownerDocument: Document,
  renderState: EditorRenderState,
  viewState: EditorViewState,
): HTMLElement {
  const panel = createElement(ownerDocument, "div", { className: "wkf__panel" });
  panel.append(
    renderHeader(ownerDocument),
    renderMainLayout(ownerDocument, renderState, viewState),
  );

  const preview = renderPreviewPanel(ownerDocument, viewState);
  if (preview) {
    panel.append(preview);
  }

  panel.append(renderFooter(ownerDocument, viewState));
  return panel;
}

function renderHeader(ownerDocument: Document): HTMLElement {
  const header = createElement(ownerDocument, "div", {
    className: "wkf__header",
    dataset: { wkfDragHandle: "true" },
  });
  const titleWrap = createElement(ownerDocument, "div");
  titleWrap.append(
    createElement(ownerDocument, "p", { className: "wkf__kicker", textContent: "web-keyframes editor" }),
    createElement(ownerDocument, "h2", { className: "wkf__title", textContent: "Keyframe Data Editor" }),
  );

  const actions = createElement(ownerDocument, "div", {
    className: "wkf__actions",
    dataset: { wkfNoDrag: "true" },
  });
  actions.append(
    createButton(ownerDocument, "Reset", { action: "reset", ghost: true }),
    createButton(ownerDocument, "Hide", { action: "hide", ghost: true }),
  );

  header.append(titleWrap, actions);
  return header;
}

function renderMainLayout(
  ownerDocument: Document,
  renderState: EditorRenderState,
  viewState: EditorViewState,
): HTMLElement {
  const layout = createElement(ownerDocument, "div", { className: "wkf__layout" });
  const columns = createElement(ownerDocument, "div", { className: "wkf__columns" });
  columns.append(
    renderTimelineListSection(ownerDocument, renderState, viewState),
  );

  const section = createElement(ownerDocument, "div", { className: "wkf__section" });
  section.append(renderSelectedTimelineSection(ownerDocument, renderState.selectedTimeline));

  const stackedColumns = createElement(ownerDocument, "div", {
    className: "wkf__columns wkf__columns--stacked",
  });
  stackedColumns.append(
    renderKeyframeListSection(ownerDocument, renderState, viewState),
    renderSelectedKeyframeSection(ownerDocument, renderState, viewState),
  );
  section.append(stackedColumns);

  columns.append(section);
  layout.append(columns);
  return layout;
}

function renderTimelineListSection(
  ownerDocument: Document,
  { renderTimelines }: EditorRenderState,
  viewState: EditorViewState,
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section wkf__section--list" });
  const head = createSectionHead(ownerDocument, "Timelines");
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  actions.append(
    createButton(ownerDocument, "Add", { action: "add-timeline", small: true }),
    createButton(ownerDocument, "Duplicate", { action: "duplicate-timeline", small: true, ghost: true }),
    createButton(ownerDocument, "Delete", {
      action: "delete-timeline",
      small: true,
      ghost: true,
      disabled: renderTimelines.length <= 1,
    }),
  );
  head.append(actions);

  const list = createElement(ownerDocument, "div", { className: "wkf__keyframe-list" });
  renderTimelines.forEach((timeline, index) => {
    const button = createButton(ownerDocument, "", {
      action: "select-timeline",
      dataset: { wkfIndex: String(index) },
      className: `wkf__keyframe-item${index === viewState.selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}`,
    });
    button.append(
      createElement(ownerDocument, "span", { className: "wkf__keyframe-time", textContent: timeline.id }),
      createElement(ownerDocument, "span", { className: "wkf__keyframe-percent", textContent: formatTimelinePositionSummary(timeline) }),
      createElement(ownerDocument, "span", { className: "wkf__keyframe-meta", textContent: formatTimelineSummary(timeline) }),
    );
    list.append(button);
  });

  section.append(head, list);
  return section;
}

function renderSelectedTimelineSection(
  ownerDocument: Document,
  selectedTimeline: EditorRenderState["selectedTimeline"],
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section" });
  section.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Selected Timeline" }));

  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--meta" });
  grid.append(
    renderTextField(ownerDocument, "id", "ID", selectedTimeline.id),
    renderSelectField(ownerDocument, "positionType", "Keyframe Position", selectedTimeline.positionType, [
      { value: "time", label: "time" },
      { value: "percent", label: "percent" },
    ]),
  );

  if (selectedTimeline.positionType === "time") {
    grid.append(renderNumberField(ownerDocument, "duration", "Duration", selectedTimeline.duration ?? 1, 1, 1));
  }

  grid.append(
    renderSelectField(ownerDocument, "translateUnit", "Translate Unit", selectedTimeline.translateConfig.unit, [
      { value: "px", label: "px" },
      { value: "vw", label: "vw" },
      { value: "vh", label: "vh" },
      { value: "%", label: "%" },
      { value: "custom", label: "custom" },
    ]),
  );

  if (selectedTimeline.translateConfig.unit === "custom") {
    grid.append(
      renderTextField(
        ownerDocument,
        "translateCustomUnit",
        "Custom Unit",
        selectedTimeline.translateConfig.customUnit ?? "",
      ),
    );
  }

  section.append(grid);
  return section;
}

function renderKeyframeListSection(
  ownerDocument: Document,
  { selectedTimeline, selectedSourceTimeline }: EditorRenderState,
  viewState: EditorViewState,
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section wkf__section--list" });
  const head = createSectionHead(ownerDocument, "Keyframes");
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  actions.append(
    createButton(ownerDocument, "Add", { action: "add-keyframe", small: true }),
    createButton(ownerDocument, "Duplicate", {
      action: "duplicate-keyframe",
      small: true,
      ghost: true,
      disabled: selectedTimeline.keyframes.length === 0,
    }),
    createButton(ownerDocument, "Delete", {
      action: "delete-keyframe",
      small: true,
      ghost: true,
      disabled: selectedTimeline.keyframes.length === 0,
    }),
  );
  head.append(actions);

  const list = createElement(ownerDocument, "div", { className: "wkf__keyframe-list" });
  if (selectedTimeline.keyframes.length === 0) {
    const item = createElement(ownerDocument, "div", { className: "wkf__keyframe-item" });
    item.append(createElement(ownerDocument, "span", { className: "wkf__keyframe-meta", textContent: "No keyframes yet." }));
    list.append(item);
  } else {
    selectedTimeline.keyframes.forEach((keyframe, index) => {
      const button = createButton(ownerDocument, "", {
        action: "select-keyframe",
        dataset: { wkfIndex: String(index) },
        className: `wkf__keyframe-item${index === viewState.selectedKeyframeIndex ? " wkf__keyframe-item--active" : ""}`,
      });
      button.append(
        createElement(ownerDocument, "span", {
          className: "wkf__keyframe-time",
          textContent: formatKeyframePositionLabel(keyframe, selectedTimeline),
        }),
        createElement(ownerDocument, "span", {
          className: "wkf__keyframe-percent",
          textContent: formatKeyframeSecondaryLabel(keyframe, selectedTimeline),
        }),
        createElement(ownerDocument, "span", {
          className: "wkf__keyframe-meta",
          textContent: formatKeyframeSummary(
            selectedSourceTimeline.keyframes[index] ?? keyframe,
            selectedTimeline.translateConfig,
          ),
        }),
      );
      list.append(button);
    });
  }

  section.append(head, list);
  return section;
}

function renderSelectedKeyframeSection(
  ownerDocument: Document,
  renderState: EditorRenderState,
  _viewState: EditorViewState,
): HTMLElement {
  const {
    selectedTimeline,
    selectedKeyframe,
    hasSelectedKeyframe,
    opacitySourceState,
    selectedSourceOpacity,
    selectedSourceTransforms,
    selectedTimingFunction,
    transformSourceState,
  } = renderState;
  const resolvedSelectedKeyframe = selectedKeyframe ?? selectedTimeline.keyframes[0];

  const section = createElement(ownerDocument, "div", { className: "wkf__section wkf__section--editor" });
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  const headText = createElement(ownerDocument, "div");
  headText.append(
    createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Selected Keyframe" }),
    createElement(ownerDocument, "p", {
      className: "wkf__subtitle",
      textContent: hasSelectedKeyframe
        ? formatSelectedKeyframeSubtitle(resolvedSelectedKeyframe, selectedTimeline)
        : "Add a keyframe to start editing.",
    }),
  );
  head.append(headText);
  section.append(head);

  if (!hasSelectedKeyframe) {
    const property = createElement(ownerDocument, "div", { className: "wkf__property" });
    property.append(
      createElement(ownerDocument, "p", { className: "wkf__subtitle", textContent: "This timeline has no keyframes yet." }),
      createElement(ownerDocument, "p", { className: "wkf__subtitle", textContent: "Use the Add button above to create the first keyframe." }),
    );
    section.append(property);
    return section;
  }

  section.append(
    renderSelectedKeyframeEditor(
      ownerDocument,
      selectedTimeline,
      resolvedSelectedKeyframe,
      selectedTimingFunction,
      opacitySourceState,
      selectedSourceOpacity,
      transformSourceState,
      selectedSourceTransforms,
    ),
  );
  return section;
}

function renderSelectedKeyframeEditor(
  ownerDocument: Document,
  selectedTimeline: EditorRenderState["selectedTimeline"],
  selectedKeyframe: WebKeyframe,
  selectedTimingFunction: string,
  opacitySourceState: EditorRenderState["opacitySourceState"],
  selectedSourceOpacity: number | null,
  transformSourceState: EditorRenderState["transformSourceState"],
  selectedSourceTransforms: TransformOperation[],
): DocumentFragment {
  const fragment = ownerDocument.createDocumentFragment();
  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--editor" });
  grid.append(
    renderRangeField(
      ownerDocument,
      "position",
      selectedTimeline.positionType === "time" ? "Time" : "Percent",
      getEditorPosition(selectedKeyframe, selectedTimeline.positionType),
      0,
      selectedTimeline.positionType === "time" ? Math.max(selectedTimeline.duration ?? 1, 1) : 100,
      selectedTimeline.positionType === "time" ? 1 : 0.1,
      selectedTimeline.positionType === "time" ? "ms" : "%",
    ),
    renderTextField(ownerDocument, "timingFunction", "Timing Function", selectedTimingFunction),
    renderTimingFunctionPresets(ownerDocument),
  );
  fragment.append(grid);

  const propertyHead = createElement(ownerDocument, "div", {
    className: "wkf__section-head wkf__section-head--properties",
  });
  propertyHead.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Properties" }));
  fragment.append(propertyHead);

  const addActions = renderKeyframePropertyActions(ownerDocument, opacitySourceState, transformSourceState);
  if (addActions) {
    fragment.append(addActions);
  }

  const propertyList = createElement(ownerDocument, "div", { className: "wkf__property-list" });
  const opacityProperty = renderOpacityProperty(ownerDocument, opacitySourceState, selectedSourceOpacity);
  if (opacityProperty) {
    propertyList.append(opacityProperty);
  }
  const transformProperty = renderTransformProperty(ownerDocument, transformSourceState, selectedSourceTransforms);
  if (transformProperty) {
    propertyList.append(transformProperty);
  }
  fragment.append(propertyList);

  return fragment;
}

function renderKeyframePropertyActions(
  ownerDocument: Document,
  opacitySourceState: EditorRenderState["opacitySourceState"],
  transformSourceState: EditorRenderState["transformSourceState"],
): HTMLElement | null {
  if (opacitySourceState !== "unset" && transformSourceState !== "unset") {
    return null;
  }

  const wrap = createElement(ownerDocument, "div", { className: "wkf__property-add" });
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  if (opacitySourceState === "unset") {
    actions.append(createButton(ownerDocument, "+ Opacity", { action: "add-opacity", small: true, ghost: true }));
  }
  if (transformSourceState === "unset") {
    actions.append(createButton(ownerDocument, "+ Transform", { action: "add-transform", small: true, ghost: true }));
  }
  wrap.append(actions);
  return wrap;
}

function renderOpacityProperty(
  ownerDocument: Document,
  opacitySourceState: EditorRenderState["opacitySourceState"],
  selectedSourceOpacity: number | null,
): HTMLElement | null {
  if (opacitySourceState !== "explicit") {
    return null;
  }

  const property = createElement(ownerDocument, "div", { className: "wkf__property" });
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  const title = createElement(ownerDocument, "div");
  title.append(
    createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Opacity" }),
    createElement(ownerDocument, "p", { className: "wkf__subtitle", textContent: `Set to ${formatNumber(selectedSourceOpacity ?? 1)}` }),
  );
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  actions.append(createButton(ownerDocument, "Delete", { action: "delete-opacity", small: true, ghost: true }));
  head.append(title, actions);

  property.append(
    head,
    renderBoundedNumberField(ownerDocument, "opacity", "Opacity", selectedSourceOpacity ?? 1, 0, 0.01, 1),
  );
  return property;
}

function renderTransformProperty(
  ownerDocument: Document,
  transformSourceState: EditorRenderState["transformSourceState"],
  selectedSourceTransforms: TransformOperation[],
): HTMLElement | null {
  if (transformSourceState === "unset") {
    return null;
  }

  const property = createElement(ownerDocument, "div", { className: "wkf__property" });
  const addActions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  addActions.append(
    createButton(ownerDocument, "+ Translate", { action: "add-transform", kind: "translate", small: true, ghost: true }),
    createButton(ownerDocument, "+ Scale", { action: "add-transform", kind: "scale", small: true, ghost: true }),
    createButton(ownerDocument, "+ Rotate", { action: "add-transform", kind: "rotate", small: true, ghost: true }),
    createButton(ownerDocument, "+ Skew", { action: "add-transform", kind: "skew", small: true, ghost: true }),
  );
  property.append(addActions, renderTransformPropertySummary(ownerDocument, transformSourceState, selectedSourceTransforms.length));

  const list = createElement(ownerDocument, "div", { className: "wkf__transform-list" });
  selectedSourceTransforms.forEach((transform, index) => {
    list.append(renderTransformEditor(ownerDocument, transform, index, selectedSourceTransforms.length));
  });
  property.append(list);
  return property;
}

function renderTransformPropertySummary(
  ownerDocument: Document,
  transformSourceState: EditorRenderState["transformSourceState"],
  transformCount: number,
): HTMLElement {
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  const title = createElement(ownerDocument, "div");
  title.append(
    createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Transforms" }),
    createElement(ownerDocument, "p", {
      className: "wkf__subtitle",
      textContent: transformSourceState === "none" ? "None" : `${transformCount} item${transformCount === 1 ? "" : "s"}`,
    }),
  );
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  actions.append(
    createButton(ownerDocument, "Delete", { action: "delete-transforms", small: true, ghost: true }),
  );
  if (transformSourceState !== "none") {
    actions.append(createButton(ownerDocument, "None", { action: "clear-transforms", small: true, ghost: true }));
  }
  head.append(title, actions);
  return head;
}

function renderPreviewPanel(ownerDocument: Document, viewState: EditorViewState): HTMLElement | null {
  if (viewState.previewTitle === null) {
    return null;
  }

  const preview = createElement(ownerDocument, "div", { className: "wkf__preview" });
  const head = createElement(ownerDocument, "div", { className: "wkf__preview-head" });
  const title = createElement(ownerDocument, "div");
  title.append(
    createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: viewState.previewTitle }),
    createElement(ownerDocument, "p", { className: "wkf__subtitle", textContent: "Current generated output" }),
  );
  head.append(title, createButton(ownerDocument, "Close", { action: "close-preview", small: true, ghost: true }));

  const textarea = createElement(ownerDocument, "textarea", { className: "wkf__preview-textarea" }) as HTMLTextAreaElement;
  textarea.readOnly = true;
  textarea.value = viewState.previewContent;

  preview.append(head, textarea);
  return preview;
}

function renderFooter(ownerDocument: Document, viewState: EditorViewState): HTMLElement {
  const footer = createElement(ownerDocument, "div", {
    className: "wkf__footer",
    dataset: { wkfDragHandle: "true" },
  });
  footer.append(
    createElement(ownerDocument, "p", {
      className: `wkf__note wkf__note--${viewState.statusTone}`,
      textContent: viewState.statusMessage,
      dataset: { wkfStatus: "" },
    }),
  );

  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  actions.append(
    createButton(ownerDocument, "Preview", { action: "run-preview", small: true, ghost: true }),
    createButton(ownerDocument, "Reset Preview", { action: "reset-preview", small: true, ghost: true }),
    createButton(ownerDocument, "View JSON", { action: "view-json", small: true, ghost: true }),
    createButton(ownerDocument, "View CSS", { action: "view-css", small: true, ghost: true }),
    createButton(ownerDocument, "Copy JSON", { action: "copy-json", small: true, ghost: true }),
    createButton(ownerDocument, "Copy CSS", { action: "copy-css", small: true }),
  );
  footer.append(actions);
  return footer;
}

function renderTextField(ownerDocument: Document, field: string, label: string, value: string): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(
    createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }),
  );
  const input = createElement(ownerDocument, "input", {
    className: "wkf__input",
    dataset: { wkfField: field },
  }) as HTMLInputElement;
  input.type = "text";
  input.value = value;
  fieldElement.append(input);
  return fieldElement;
}

function renderSelectField(
  ownerDocument: Document,
  field: string,
  label: string,
  value: string,
  options: Array<{ label: string; value: string }>,
): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const select = createElement(ownerDocument, "select", {
    className: "wkf__input",
    dataset: { wkfField: field },
  }) as HTMLSelectElement;
  options.forEach((option) => {
    const optionElement = createElement(ownerDocument, "option") as HTMLOptionElement;
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === value;
    select.append(optionElement);
  });
  fieldElement.append(select);
  return fieldElement;
}

function renderNumberField(
  ownerDocument: Document,
  field: string,
  label: string,
  value: number,
  min?: number,
  step?: number,
  max?: number,
): HTMLElement {
  const fieldElement = createField(ownerDocument);
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const input = createNumericInput(ownerDocument, field, value, min, step, max);
  fieldElement.append(input);
  return fieldElement;
}

function renderBoundedNumberField(
  ownerDocument: Document,
  field: string,
  label: string,
  value: number,
  min: number,
  step: number,
  max: number,
): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--full");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const row = createElement(ownerDocument, "div", { className: "wkf__time-row" });
  const range = createNumericInput(ownerDocument, field, value, min, step, max);
  range.className = "wkf__range";
  range.type = "range";
  row.append(range, createNumericInput(ownerDocument, field, value, min, step, max));
  fieldElement.append(row);
  return fieldElement;
}

function renderRangeField(
  ownerDocument: Document,
  field: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  suffix = "",
): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--time");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: label }));
  const row = createElement(ownerDocument, "div", { className: "wkf__time-row" });
  const range = createNumericInput(ownerDocument, field, value, min, step, max);
  range.className = "wkf__range";
  range.type = "range";
  row.append(range, createNumericInput(ownerDocument, field, value, min, step, max));
  fieldElement.append(row);
  if (suffix !== "") {
    fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__subtitle", textContent: suffix }));
  }
  return fieldElement;
}

function renderTimingFunctionPresets(ownerDocument: Document): HTMLElement {
  const fieldElement = createField(ownerDocument, "wkf__field wkf__field--full");
  fieldElement.append(createElement(ownerDocument, "span", { className: "wkf__label", textContent: "Insert Preset" }));
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  TIMING_FUNCTION_PRESETS.forEach((value) => {
    actions.append(createButton(ownerDocument, value, {
      action: "set-timing-function",
      small: true,
      ghost: true,
      dataset: { wkfValue: value },
    }));
  });
  actions.append(createButton(ownerDocument, "Clear", { action: "clear-timing-function", small: true, ghost: true }));
  fieldElement.append(actions);
  return fieldElement;
}

function renderTransformEditor(
  ownerDocument: Document,
  transform: TransformOperation,
  index: number,
  total: number,
): HTMLElement {
  const field = createField(ownerDocument);
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  const left = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  left.append(
    renderSelectField(ownerDocument, `transform-kind-${index}`, `Transform ${index + 1}`, transform.kind, [
      { value: "translate", label: "translate" },
      { value: "scale", label: "scale" },
      { value: "rotate", label: "rotate" },
      { value: "skew", label: "skew" },
    ]),
  );
  const right = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  right.append(
    createButton(ownerDocument, "Up", {
      action: "move-transform-up",
      small: true,
      ghost: true,
      disabled: index === 0,
      dataset: { wkfIndex: String(index) },
    }),
    createButton(ownerDocument, "Down", {
      action: "move-transform-down",
      small: true,
      ghost: true,
      disabled: index === total - 1,
      dataset: { wkfIndex: String(index) },
    }),
    createButton(ownerDocument, "Delete", {
      action: "delete-transform",
      small: true,
      ghost: true,
      dataset: { wkfIndex: String(index) },
    }),
  );
  head.append(left, right);

  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--editor" });
  renderTransformFields(ownerDocument, transform, index).forEach((fieldElement) => {
    grid.append(fieldElement);
  });

  field.append(head, grid);
  return field;
}

function renderTransformFields(
  ownerDocument: Document,
  transform: TransformOperation,
  index: number,
): HTMLElement[] {
  switch (transform.kind) {
    case "translate":
      return [
        renderNumberField(ownerDocument, `transform-x-${index}`, "X", transform.x),
        renderNumberField(ownerDocument, `transform-y-${index}`, "Y", transform.y),
      ];
    case "scale":
      return [
        renderNumberField(ownerDocument, `transform-x-${index}`, "Scale X", transform.x, 0.001, 0.001),
        renderNumberField(ownerDocument, `transform-y-${index}`, "Scale Y", transform.y, 0.001, 0.001),
      ];
    case "rotate":
      return [renderNumberField(ownerDocument, `transform-value-${index}`, "Rotate", transform.value, undefined, 0.1)];
    case "skew":
      return [
        renderNumberField(ownerDocument, `transform-x-${index}`, "Skew X", transform.x, undefined, 0.1),
        renderNumberField(ownerDocument, `transform-y-${index}`, "Skew Y", transform.y, undefined, 0.1),
      ];
  }
}

function createSectionHead(ownerDocument: Document, title: string): HTMLElement {
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  head.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: title }));
  return head;
}

function createField(ownerDocument: Document, className = "wkf__field"): HTMLElement {
  return createElement(ownerDocument, "label", { className });
}

function createNumericInput(
  ownerDocument: Document,
  field: string,
  value: number,
  min?: number,
  step?: number,
  max?: number,
): HTMLInputElement {
  const input = createElement(ownerDocument, "input", {
    className: "wkf__input",
    dataset: { wkfField: field },
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
  return input;
}

function createButton(
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
  return button;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
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

function getEditorPosition(
  keyframe: WebKeyframe,
  positionType: EditorTimelineView["positionType"],
): number {
  return positionType === "time" ? keyframe.time ?? 0 : keyframe.percent ?? 0;
}

function formatTimelineSummary(timeline: EditorTimelineView): string {
  return `${timeline.keyframes.length} keyframes`;
}

function formatTimelinePositionSummary(timeline: EditorTimelineView): string {
  return timeline.positionType === "time" ? `${String(timeline.duration ?? 1)}ms` : "percent mode";
}

function formatKeyframeSummary(
  keyframe: WebKeyframesTimeline["keyframes"][number],
  translateConfig: EditorTranslateView,
): string {
  const parts: string[] = [];
  const transformState = hasKeyframeProperty(keyframe, "transform");
  const transforms = transformState ? getTransformOperations(keyframe) : [];
  const opacity = getOpacityValue(keyframe);

  if (transformState) {
    parts.push(
      transforms.length > 0
        ? transforms.map((transform) => formatTransformSummary(transform, translateConfig)).join(" ")
        : "transform: none",
    );
  }

  if (typeof opacity === "number" && Number.isFinite(opacity)) {
    parts.push(`opacity ${formatNumber(opacity)}`);
  }

  if (typeof keyframe.timingFunction === "string" && keyframe.timingFunction.trim() !== "") {
    parts.push(`timingFunction ${keyframe.timingFunction.trim()}`);
  }

  return parts.join(", ");
}

function formatTransformSummary(transform: TransformOperation, translateConfig: EditorTranslateView): string {
  switch (transform.kind) {
    case "translate":
      return `translate(${formatSummaryTranslateValue(transform.x, translateConfig)}, ${formatSummaryTranslateValue(transform.y, translateConfig)})`;
    case "scale":
      return `scale(${formatNumber(transform.x)}, ${formatNumber(transform.y)})`;
    case "rotate":
      return `rotate(${formatNumber(transform.value)}deg)`;
    case "skew":
      return `skew(${formatNumber(transform.x)}deg, ${formatNumber(transform.y)}deg)`;
  }
}

function formatSummaryTranslateValue(value: number, translateConfig: EditorTranslateView): string {
  const unit = translateConfig.unit === "custom" ? translateConfig.customUnit || "px" : translateConfig.unit;
  return `${formatNumber(value)}${unit}`;
}

function formatKeyframePositionLabel(keyframe: WebKeyframe, timeline: EditorTimelineView): string {
  return timeline.positionType === "time" ? `${formatNumber(keyframe.time ?? 0)}ms` : `${formatNumber(keyframe.percent ?? 0)}%`;
}

function formatKeyframeSecondaryLabel(keyframe: WebKeyframe, timeline: EditorTimelineView): string {
  if (timeline.positionType === "time") {
    const safeDuration = (timeline.duration ?? 1) <= 0 ? 1 : (timeline.duration ?? 1);
    return `${formatNumber(((keyframe.time ?? 0) / safeDuration) * 100)}%`;
  }

  return "";
}

function formatSelectedKeyframeSubtitle(keyframe: WebKeyframe, timeline: EditorTimelineView): string {
  if (timeline.positionType === "time") {
    return `${formatKeyframeSecondaryLabel(keyframe, timeline)} of timeline`;
  }

  return `${formatNumber(keyframe.percent ?? 0)}% of timeline`;
}
