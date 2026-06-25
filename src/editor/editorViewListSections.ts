import { formatNumber } from "../core/generateCss.js";
import {
  getOpacityValue,
  getTransformOperations,
  hasKeyframeProperty,
} from "../core/normalize.js";
import type { TransformOperation, WebKeyframe, WebKeyframesTimeline } from "../core/types.js";
import {
  createButton,
  createElement,
  createSectionHead,
} from "./editorViewPrimitives.js";
import type {
  EditorRenderState,
  EditorViewHandlers,
  EditorViewState,
} from "./editorViewTypes.js";

type EditorTimelineView = EditorRenderState["selectedTimeline"];
type EditorTranslateView = EditorTimelineView["translateConfig"];

export function renderTimelineListSection(
  ownerDocument: Document,
  { renderTimelines }: EditorRenderState,
  viewState: EditorViewState,
  handlers: EditorViewHandlers,
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section wkf__section--list" });
  const head = createSectionHead(ownerDocument, "Timelines");
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  actions.append(
    createButton(ownerDocument, "Add", { action: "add-timeline", small: true }, handlers),
    createButton(ownerDocument, "Duplicate", { action: "duplicate-timeline", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "Delete", {
      action: "delete-timeline",
      small: true,
      ghost: true,
      disabled: renderTimelines.length <= 1,
    }, handlers),
  );
  head.append(actions);

  const list = createElement(ownerDocument, "div", { className: "wkf__keyframe-list" });
  renderTimelines.forEach((timeline, index) => {
    const button = createButton(ownerDocument, "", {
      action: "select-timeline",
      dataset: { wkfIndex: String(index) },
      className: `wkf__keyframe-item${index === viewState.selectedTimelineIndex ? " wkf__keyframe-item--active" : ""}`,
    }, handlers);
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

export function renderKeyframeListSection(
  ownerDocument: Document,
  { selectedTimeline, selectedSourceTimeline }: EditorRenderState,
  viewState: EditorViewState,
  handlers: EditorViewHandlers,
): HTMLElement {
  const section = createElement(ownerDocument, "div", { className: "wkf__section wkf__section--list" });
  const head = createSectionHead(ownerDocument, "Keyframes");
  const actions = createElement(ownerDocument, "div", { className: "wkf__inline-actions wkf__inline-actions--wrap" });
  actions.append(
    createButton(ownerDocument, "Add", { action: "add-keyframe", small: true }, handlers),
    createButton(ownerDocument, "Duplicate", {
      action: "duplicate-keyframe",
      small: true,
      ghost: true,
      disabled: selectedTimeline.keyframes.length === 0,
    }, handlers),
    createButton(ownerDocument, "Delete", {
      action: "delete-keyframe",
      small: true,
      ghost: true,
      disabled: selectedTimeline.keyframes.length === 0,
    }, handlers),
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
      }, handlers);
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
