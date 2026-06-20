export type TransformKind = "translate" | "scale" | "rotate" | "skew";

export type TranslateTransform = {
  kind: "translate";
  x: number;
  y: number;
};

export type ScaleTransform = {
  kind: "scale";
  x: number;
  y: number;
};

export type RotateTransform = {
  kind: "rotate";
  value: number;
};

export type SkewTransform = {
  kind: "skew";
  x: number;
  y: number;
};

export type TransformOperation =
  | TranslateTransform
  | ScaleTransform
  | RotateTransform
  | SkewTransform;

export type OpacityProperty = {
  kind: "opacity";
  value: number;
};

export type TransformProperty = {
  kind: "transform";
  value: TransformOperation[];
};

export type KeyframeProperty =
  | OpacityProperty
  | TransformProperty;

export type PropertyKind = KeyframeProperty["kind"];

export type WebKeyframe = {
  time: number;
  properties?: KeyframeProperty[];
};

export type NormalizedWebKeyframe = {
  time: number;
  properties: KeyframeProperty[];
};

export type TranslateUnit = "px" | "vw" | "vh" | "%" | "custom";

export type TranslateConfig = {
  unit: TranslateUnit;
  customUnit?: string;
};

export type WebKeyframesTimeline = {
  id: string;
  duration: number;
  translateConfig?: TranslateConfig;
  keyframes: WebKeyframe[];
};

export type WebKeyframesDocument = {
  timelines: WebKeyframesTimeline[];
};

export type NormalizedTranslateConfig = {
  unit: TranslateUnit;
  customUnit: string | null;
};

export type NormalizedWebKeyframesTimeline = Omit<WebKeyframesTimeline, "translateConfig" | "keyframes"> & {
  translateConfig: NormalizedTranslateConfig;
  keyframes: NormalizedWebKeyframe[];
};

export type NormalizedWebKeyframesDocument = {
  timelines: NormalizedWebKeyframesTimeline[];
};
