import type { WebKeyframesDocument, WebKeyframesTimeline } from "../core/types.js";
import {
  addKeyframe as addKeyframeToTimeline,
  addTimeline as addTimelineToDocument,
  deleteKeyframe as deleteKeyframeFromTimeline,
  deleteTimeline as deleteTimelineFromDocument,
  duplicateKeyframe as duplicateKeyframeInTimeline,
  duplicateTimeline as duplicateTimelineInDocument,
} from "./editorCollectionActions.js";
import { EditorStateController } from "./editorStateController.js";

type StatusTone = "info" | "success" | "error";

type EditorCollectionControllerOptions = {
  defaultTimelineData: WebKeyframesTimeline;
  getData: () => WebKeyframesDocument;
  setData: (data: WebKeyframesDocument) => void;
  getSelectedTimelineIndex: () => number;
  setSelectedTimelineIndex: (index: number) => void;
  getSelectedKeyframeIndex: () => number;
  setSelectedKeyframeIndex: (index: number) => void;
  normalizeEditorState: () => void;
  render: () => void;
  renderWithStatus: (tone: StatusTone, message: string) => void;
  stateController: EditorStateController;
};

export class EditorCollectionController {
  private readonly defaultTimelineData: WebKeyframesTimeline;
  private readonly getDataState: () => WebKeyframesDocument;
  private readonly setDataState: (data: WebKeyframesDocument) => void;
  private readonly getSelectedTimelineIndexState: () => number;
  private readonly setSelectedTimelineIndexState: (index: number) => void;
  private readonly getSelectedKeyframeIndexState: () => number;
  private readonly setSelectedKeyframeIndexState: (index: number) => void;
  private readonly normalizeEditorStateCallback: () => void;
  private readonly renderCallback: () => void;
  private readonly renderWithStatusCallback: (tone: StatusTone, message: string) => void;
  private readonly stateController: EditorStateController;

  constructor(options: EditorCollectionControllerOptions) {
    this.defaultTimelineData = options.defaultTimelineData;
    this.getDataState = options.getData;
    this.setDataState = options.setData;
    this.getSelectedTimelineIndexState = options.getSelectedTimelineIndex;
    this.setSelectedTimelineIndexState = options.setSelectedTimelineIndex;
    this.getSelectedKeyframeIndexState = options.getSelectedKeyframeIndex;
    this.setSelectedKeyframeIndexState = options.setSelectedKeyframeIndex;
    this.normalizeEditorStateCallback = options.normalizeEditorState;
    this.renderCallback = options.render;
    this.renderWithStatusCallback = options.renderWithStatus;
    this.stateController = options.stateController;
  }

  addTimeline(): void {
    const nextState = addTimelineToDocument(
      this.getDataState(),
      this.getSelectedTimelineIndexState(),
      this.defaultTimelineData,
    );
    this.setDataState(nextState.data);
    this.setSelectedTimelineIndexState(nextState.selectedTimelineIndex);
    this.setSelectedKeyframeIndexState(nextState.selectedKeyframeIndex);
    this.renderWithStatusCallback("info", "Added timeline.");
  }

  duplicateTimeline(): void {
    const nextState = duplicateTimelineInDocument(
      this.getDataState(),
      this.getSelectedTimelineIndexState(),
      this.defaultTimelineData,
    );
    this.setDataState(nextState.data);
    this.setSelectedTimelineIndexState(nextState.selectedTimelineIndex);
    this.normalizeEditorStateCallback();
    this.renderWithStatusCallback("info", "Duplicated timeline.");
  }

  deleteTimeline(): void {
    if (this.getDataState().timelines.length <= 1) {
      return;
    }

    this.setDataState(
      deleteTimelineFromDocument(
        this.getDataState(),
        this.getSelectedTimelineIndexState(),
        this.defaultTimelineData,
      ).data,
    );
    this.normalizeEditorStateCallback();
    this.renderWithStatusCallback("info", "Deleted timeline.");
  }

  addKeyframe(): void {
    this.stateController.updateSelectedTimeline((timeline) => {
      const nextState = addKeyframeToTimeline(
        timeline,
        this.getSelectedKeyframeIndexState(),
        (keyframes, positionType) => this.stateController.sortKeyframesByPosition(keyframes, positionType),
      );
      timeline.keyframes = nextState.timeline.keyframes;
      this.setSelectedKeyframeIndexState(nextState.selectedKeyframeIndex);
    });
    this.renderCallback();
  }

  deleteKeyframe(): void {
    if (this.stateController.getSelectedTimeline().keyframes.length === 0) {
      return;
    }

    this.stateController.updateSelectedTimeline((timeline) => {
      const nextState = deleteKeyframeFromTimeline(timeline, this.getSelectedKeyframeIndexState());
      timeline.keyframes = nextState.timeline.keyframes;
      this.setSelectedKeyframeIndexState(nextState.selectedKeyframeIndex);
    });
    this.renderCallback();
  }

  duplicateKeyframe(): void {
    this.stateController.updateSelectedTimeline((timeline) => {
      const nextState = duplicateKeyframeInTimeline(
        timeline,
        this.getSelectedKeyframeIndexState(),
        (keyframes, positionType) => this.stateController.sortKeyframesByPosition(keyframes, positionType),
      );
      if (!nextState) {
        return;
      }
      timeline.keyframes = nextState.timeline.keyframes;
      this.setSelectedKeyframeIndexState(nextState.selectedKeyframeIndex);
    });
    this.renderWithStatusCallback("info", "Duplicated selected keyframe.");
  }
}
