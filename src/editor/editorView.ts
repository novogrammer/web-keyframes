import {
  createButton,
  createElement,
} from "./editorViewPrimitives.js";
import {
  renderSelectedKeyframeSection,
  renderSelectedTimelineSection,
} from "./editorViewEditorSections.js";
import {
  renderKeyframeListSection,
  renderTimelineListSection,
} from "./editorViewListSections.js";
import type {
  EditorFieldRegistry,
  EditorRenderState,
  EditorViewHandlers,
  EditorViewState,
  RenderedEditorPanel,
} from "./editorViewTypes.js";

export function renderEditorPanel(
  ownerDocument: Document,
  renderState: EditorRenderState,
  viewState: EditorViewState,
  handlers: EditorViewHandlers,
): RenderedEditorPanel {
  const fieldRegistry: EditorFieldRegistry = new Map();
  const panel = createElement(ownerDocument, "div", { className: "wkf__panel" });
  panel.append(
    renderHeader(ownerDocument, handlers),
    renderMainLayout(ownerDocument, renderState, viewState, handlers, fieldRegistry),
  );

  const preview = renderPreviewPanel(ownerDocument, viewState, handlers);
  if (preview) {
    panel.append(preview);
  }

  panel.append(renderFooter(ownerDocument, viewState, handlers));
  return { panel, fieldRegistry };
}

function renderHeader(ownerDocument: Document, handlers: EditorViewHandlers): HTMLElement {
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
    createButton(ownerDocument, "Reset", { action: "reset", ghost: true }, handlers),
    createButton(ownerDocument, "Hide", { action: "hide", ghost: true }, handlers),
  );

  header.append(titleWrap, actions);
  return header;
}

function renderMainLayout(
  ownerDocument: Document,
  renderState: EditorRenderState,
  viewState: EditorViewState,
  handlers: EditorViewHandlers,
  fieldRegistry: EditorFieldRegistry,
): HTMLElement {
  const layout = createElement(ownerDocument, "div", { className: "wkf__layout" });
  const columns = createElement(ownerDocument, "div", { className: "wkf__columns" });
  columns.append(
    renderTimelineListSection(ownerDocument, renderState, viewState, handlers),
  );

  const section = createElement(ownerDocument, "div", { className: "wkf__section" });
  section.append(renderSelectedTimelineSection(ownerDocument, renderState.selectedTimeline, handlers, fieldRegistry));

  const stackedColumns = createElement(ownerDocument, "div", {
    className: "wkf__columns wkf__columns--stacked",
  });
  stackedColumns.append(
    renderKeyframeListSection(ownerDocument, renderState, viewState, handlers),
    renderSelectedKeyframeSection(ownerDocument, renderState, handlers, fieldRegistry),
  );
  section.append(stackedColumns);

  columns.append(section);
  layout.append(columns);
  return layout;
}

function renderPreviewPanel(ownerDocument: Document, viewState: EditorViewState, handlers: EditorViewHandlers): HTMLElement | null {
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
  head.append(title, createButton(ownerDocument, "Close", { action: "close-preview", small: true, ghost: true }, handlers));

  const textarea = createElement(ownerDocument, "textarea", { className: "wkf__preview-textarea" }) as HTMLTextAreaElement;
  textarea.readOnly = true;
  textarea.value = viewState.previewContent;

  preview.append(head, textarea);
  return preview;
}

function renderFooter(ownerDocument: Document, viewState: EditorViewState, handlers: EditorViewHandlers): HTMLElement {
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
    createButton(ownerDocument, "Preview", { action: "run-preview", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "Reset Preview", { action: "reset-preview", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "View JSON", { action: "view-json", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "View CSS", { action: "view-css", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "Copy JSON", { action: "copy-json", small: true, ghost: true }, handlers),
    createButton(ownerDocument, "Copy CSS", { action: "copy-css", small: true }, handlers),
  );
  footer.append(actions);
  return footer;
}
