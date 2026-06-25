import { formatNumber } from "../core/generateCss.js";
import type { TransformOperation, WebKeyframe } from "../core/types.js";
import {
  createButton,
  createElement,
  createField,
  renderBoundedNumberField,
  renderNumberField,
  renderRangeField,
  renderSelectField,
  renderTextField,
  renderTimingFunctionPresets,
} from "./editorViewPrimitives.js";
import type {
  EditorFieldRegistry,
  EditorRenderState,
  EditorViewHandlers,
} from "./editorViewTypes.js";

export function renderSelectedTimelineSection(
  ownerDocument: Document,
  selectedTimeline: EditorRenderState["selectedTimeline"],
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section" });
  section.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Selected Timeline" }));

  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--meta" });
  grid.append(
    renderTextField(ownerDocument, "ID", selectedTimeline.id, handlers.onTimelineIdInput, fieldRegistry, "id"),
    renderSelectField(ownerDocument, "Keyframe Position", selectedTimeline.positionType, [
      { value: "time", label: "time" },
      { value: "percent", label: "percent" },
    ], handlers.onPositionTypeChange, fieldRegistry, "positionType"),
  );

  if (selectedTimeline.positionType === "time") {
    grid.append(
      renderNumberField(ownerDocument, "Duration", selectedTimeline.duration ?? 1, 1, 1, undefined, handlers.onDurationInput, fieldRegistry, "duration"),
    );
  }

  grid.append(
    renderSelectField(ownerDocument, "Translate Unit", selectedTimeline.translateConfig.unit, [
      { value: "px", label: "px" },
      { value: "vw", label: "vw" },
      { value: "vh", label: "vh" },
      { value: "%", label: "%" },
      { value: "custom", label: "custom" },
    ], handlers.onTranslateUnitChange, fieldRegistry, "translateUnit"),
  );

  if (selectedTimeline.translateConfig.unit === "custom") {
    grid.append(
      renderTextField(
        ownerDocument,
        "Custom Unit",
        selectedTimeline.translateConfig.customUnit ?? "",
        handlers.onTranslateCustomUnitInput,
        fieldRegistry,
        "translateCustomUnit",
      ),
    );
  }

  section.append(grid);
  return section;
}

export function renderSelectedKeyframeSection(
  ownerDocument: Document,
  renderState: EditorRenderState,
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
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
      handlers,
      fieldRegistry,
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
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): DocumentFragment {
  const fragment = ownerDocument.createDocumentFragment();
  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--editor" });
  grid.append(
    renderRangeField(
      ownerDocument,
      selectedTimeline.positionType === "time" ? "Time" : "Percent",
      getEditorPosition(selectedKeyframe, selectedTimeline.positionType),
      0,
      selectedTimeline.positionType === "time" ? Math.max(selectedTimeline.duration ?? 1, 1) : 100,
      selectedTimeline.positionType === "time" ? 1 : 0.1,
      selectedTimeline.positionType === "time" ? "ms" : "%",
      handlers.onKeyframePositionInput,
      fieldRegistry,
      "position",
    ),
    renderTextField(
      ownerDocument,
      "Timing Function",
      selectedTimingFunction,
      handlers.onTimingFunctionInput,
      fieldRegistry,
      "timingFunction",
    ),
    renderTimingFunctionPresets(ownerDocument, handlers),
  );
  fragment.append(grid);

  const propertyHead = createElement(ownerDocument, "div", {
    className: "wkf__section-head wkf__section-head--properties",
  });
  propertyHead.append(createElement(ownerDocument, "div", { className: "wkf__section-title", textContent: "Properties" }));
  fragment.append(propertyHead);

  const addActions = renderKeyframePropertyActions(ownerDocument, opacitySourceState, transformSourceState, handlers);
  if (addActions) {
    fragment.append(addActions);
  }

  const propertyList = createElement(ownerDocument, "div", { className: "wkf__property-list" });
  const opacityProperty = renderOpacityProperty(ownerDocument, opacitySourceState, selectedSourceOpacity, handlers, fieldRegistry);
  if (opacityProperty) {
    propertyList.append(opacityProperty);
  }
  const transformProperty = renderTransformProperty(ownerDocument, transformSourceState, selectedSourceTransforms, handlers, fieldRegistry);
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
  handlers: EditorViewHandlers,
): HTMLElement | null {
  if (opacitySourceState !== "unset" && transformSourceState !== "unset") {
    return null;
  }

  const wrap = createElement(ownerDocument, "div", { className: "wkf__property-add" });
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  if (opacitySourceState === "unset") {
    actions.append(createButton(ownerDocument, "+ Opacity", { action: "add-opacity", small: true, ghost: true }, handlers));
  }
  if (transformSourceState === "unset") {
    actions.append(createButton(ownerDocument, "+ Transform", { action: "add-transform", small: true, ghost: true }, handlers));
  }
  wrap.append(actions);
  return wrap;
}

function renderOpacityProperty(
  ownerDocument: Document,
  opacitySourceState: EditorRenderState["opacitySourceState"],
  selectedSourceOpacity: number | null,
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
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
  actions.append(createButton(ownerDocument, "Delete", { action: "delete-opacity", small: true, ghost: true }, handlers));
  head.append(title, actions);

  property.append(
    head,
    renderBoundedNumberField(
      ownerDocument,
      "Opacity",
      selectedSourceOpacity ?? 1,
      0,
      0.01,
      1,
      handlers.onOpacityInput,
      fieldRegistry,
      "opacity",
    ),
  );
  return property;
}

function renderTransformProperty(
  ownerDocument: Document,
  transformSourceState: EditorRenderState["transformSourceState"],
  selectedSourceTransforms: TransformOperation[],
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): HTMLElement | null {
  if (transformSourceState === "unset") {
    return null;
  }

  const property = createElement(ownerDocument, "div", { className: "wkf__property" });
  const addActions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  addActions.append(
    createButton(ownerDocument, "+ Translate", { action: "add-transform", kind: "translate", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "+ Scale", { action: "add-transform", kind: "scale", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "+ Rotate", { action: "add-transform", kind: "rotate", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "+ Skew", { action: "add-transform", kind: "skew", small: true, ghost: true }, handlers),
  );
  property.append(addActions, renderTransformPropertySummary(ownerDocument, transformSourceState, selectedSourceTransforms.length, handlers));

  const list = createElement(ownerDocument, "div", { className: "wkf__transform-list" });
  selectedSourceTransforms.forEach((transform, index) => {
    list.append(renderTransformEditor(ownerDocument, transform, index, selectedSourceTransforms.length, handlers, fieldRegistry));
  });
  property.append(list);
  return property;
}

function renderTransformPropertySummary(
  ownerDocument: Document,
  transformSourceState: EditorRenderState["transformSourceState"],
  transformCount: number,
  handlers: EditorViewHandlers,
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
    createButton(ownerDocument, "Delete", { action: "delete-transforms", small: true, ghost: true }, handlers),
  );
  if (transformSourceState !== "none") {
    actions.append(createButton(ownerDocument, "None", { action: "clear-transforms", small: true, ghost: true }, handlers));
  }
  head.append(title, actions);
  return head;
}

function renderTransformEditor(
  ownerDocument: Document,
  transform: TransformOperation,
  index: number,
  total: number,
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): HTMLElement {
  const field = createField(ownerDocument);
  const head = createElement(ownerDocument, "div", { className: "wkf__section-head" });
  const left = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  left.append(
    renderSelectField(ownerDocument, `Transform ${index + 1}`, transform.kind, [
      { value: "translate", label: "translate" },
      { value: "scale", label: "scale" },
      { value: "rotate", label: "rotate" },
      { value: "skew", label: "skew" },
    ], (select) => handlers.onTransformKindChange(index, select), fieldRegistry, `transform-kind-${index}`),
  );
  const right = createElement(ownerDocument, "div", { className: "wkf__inline-actions" });
  right.append(
    createButton(ownerDocument, "Up", {
      action: "move-transform-up",
      small: true,
      ghost: true,
      disabled: index === 0,
      dataset: { wkfIndex: String(index) },
    }, handlers),
    createButton(ownerDocument, "Down", {
      action: "move-transform-down",
      small: true,
      ghost: true,
      disabled: index === total - 1,
      dataset: { wkfIndex: String(index) },
    }, handlers),
    createButton(ownerDocument, "Delete", {
      action: "delete-transform",
      small: true,
      ghost: true,
      dataset: { wkfIndex: String(index) },
    }, handlers),
  );
  head.append(left, right);

  const grid = createElement(ownerDocument, "div", { className: "wkf__grid wkf__grid--editor" });
  renderTransformFields(ownerDocument, transform, index, handlers, fieldRegistry).forEach((fieldElement) => {
    grid.append(fieldElement);
  });

  field.append(head, grid);
  return field;
}

function renderTransformFields(
  ownerDocument: Document,
  transform: TransformOperation,
  index: number,
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): HTMLElement[] {
  switch (transform.kind) {
    case "translate":
      return [
        renderNumberField(ownerDocument, "X", transform.x, undefined, undefined, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "x", input, eventType), fieldRegistry, `transform-x-${index}`),
        renderNumberField(ownerDocument, "Y", transform.y, undefined, undefined, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "y", input, eventType), fieldRegistry, `transform-y-${index}`),
      ];
    case "scale":
      return [
        renderNumberField(ownerDocument, "Scale X", transform.x, 0.001, 0.001, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "x", input, eventType), fieldRegistry, `transform-x-${index}`),
        renderNumberField(ownerDocument, "Scale Y", transform.y, 0.001, 0.001, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "y", input, eventType), fieldRegistry, `transform-y-${index}`),
      ];
    case "rotate":
      return [renderNumberField(ownerDocument, "Rotate", transform.value, undefined, 0.1, undefined, (input, eventType) =>
        handlers.onTransformValueInput(index, "value", input, eventType), fieldRegistry, `transform-value-${index}`)];
    case "skew":
      return [
        renderNumberField(ownerDocument, "Skew X", transform.x, undefined, 0.1, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "x", input, eventType), fieldRegistry, `transform-x-${index}`),
        renderNumberField(ownerDocument, "Skew Y", transform.y, undefined, 0.1, undefined, (input, eventType) =>
          handlers.onTransformValueInput(index, "y", input, eventType), fieldRegistry, `transform-y-${index}`),
      ];
  }
}

function getEditorPosition(
  keyframe: WebKeyframe,
  positionType: EditorRenderState["selectedTimeline"]["positionType"],
): number {
  return positionType === "time" ? keyframe.time ?? 0 : keyframe.percent ?? 0;
}

function formatKeyframeSecondaryLabel(
  keyframe: WebKeyframe,
  timeline: EditorRenderState["selectedTimeline"],
): string {
  if (timeline.positionType === "time") {
    const safeDuration = (timeline.duration ?? 1) <= 0 ? 1 : (timeline.duration ?? 1);
    return `${formatNumber(((keyframe.time ?? 0) / safeDuration) * 100)}%`;
  }

  return "";
}

function formatSelectedKeyframeSubtitle(
  keyframe: WebKeyframe,
  timeline: EditorRenderState["selectedTimeline"],
): string {
  if (timeline.positionType === "time") {
    return `${formatKeyframeSecondaryLabel(keyframe, timeline)} of timeline`;
  }

  return `${formatNumber(keyframe.percent ?? 0)}% of timeline`;
}
