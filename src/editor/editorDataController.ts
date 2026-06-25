import { generateCss } from "../core/generateCss.js";
import { cloneDocument } from "../core/normalize.js";
import type { WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import { clampIndex, sanitizeEditorDocument } from "./editorModel.js";

type EditorDataControllerOptions = {
  defaultTimelineData: WebKeyframesTimeline;
  getData: () => WebKeyframesDocument;
  setData: (data: WebKeyframesDocument) => void;
  getSelectedTimelineIndex: () => number;
  setSelectedTimelineIndex: (index: number) => void;
  getSelectedKeyframeIndex: () => number;
  setSelectedKeyframeIndex: (index: number) => void;
  getLastNotifiedDataJson: () => string;
  setLastNotifiedDataJson: (value: string) => void;
  onDataChange?: ((data: WebKeyframesDocument) => void) | null;
};

export class EditorDataController {
  private readonly defaultTimelineData: WebKeyframesTimeline;
  private readonly getDataState: () => WebKeyframesDocument;
  private readonly setDataState: (data: WebKeyframesDocument) => void;
  private readonly getSelectedTimelineIndexState: () => number;
  private readonly setSelectedTimelineIndexState: (index: number) => void;
  private readonly getSelectedKeyframeIndexState: () => number;
  private readonly setSelectedKeyframeIndexState: (index: number) => void;
  private readonly getLastNotifiedDataJsonState: () => string;
  private readonly setLastNotifiedDataJsonState: (value: string) => void;
  private readonly onDataChange: ((data: WebKeyframesDocument) => void) | null;

  constructor(options: EditorDataControllerOptions) {
    this.defaultTimelineData = options.defaultTimelineData;
    this.getDataState = options.getData;
    this.setDataState = options.setData;
    this.getSelectedTimelineIndexState = options.getSelectedTimelineIndex;
    this.setSelectedTimelineIndexState = options.setSelectedTimelineIndex;
    this.getSelectedKeyframeIndexState = options.getSelectedKeyframeIndex;
    this.setSelectedKeyframeIndexState = options.setSelectedKeyframeIndex;
    this.getLastNotifiedDataJsonState = options.getLastNotifiedDataJson;
    this.setLastNotifiedDataJsonState = options.setLastNotifiedDataJson;
    this.onDataChange = options.onDataChange ?? null;
  }

  getData(): WebKeyframesDocument {
    return cloneDocument(this.getDataState());
  }

  setData(data: WebKeyframesDocument): void {
    this.setDataState(sanitizeEditorDocument(data, this.defaultTimelineData));
    this.normalizeState();
  }

  getJson(): string {
    return JSON.stringify(cloneDocument(this.getDataState()), null, 2);
  }

  getCss(): string {
    return generateCss(this.getDataState());
  }

  getSelectedTimeline(): WebKeyframesTimeline {
    const data = this.getDataState();
    return data.timelines[this.getSelectedTimelineIndexState()] ?? data.timelines[0];
  }

  normalizeState(): void {
    const data = sanitizeEditorDocument(this.getDataState(), this.defaultTimelineData);
    this.setDataState(data);
    this.setSelectedTimelineIndexState(clampIndex(this.getSelectedTimelineIndexState(), data.timelines.length));
    this.setSelectedKeyframeIndexState(clampIndex(this.getSelectedKeyframeIndexState(), this.getSelectedTimeline().keyframes.length));
  }

  resetData(initialData: WebKeyframesDocument): void {
    this.setDataState(cloneDocument(initialData));
    this.setSelectedTimelineIndexState(0);
    this.setSelectedKeyframeIndexState(0);
  }

  notifyDataChangeIfNeeded(): void {
    if (this.onDataChange === null) {
      return;
    }

    const nextDataJson = JSON.stringify(this.getDataState());
    if (nextDataJson === this.getLastNotifiedDataJsonState()) {
      return;
    }

    this.setLastNotifiedDataJsonState(nextDataJson);
    this.onDataChange(cloneDocument(this.getDataState()));
  }
}
