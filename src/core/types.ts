export type TransformKind = "translate" | "scale" | "rotate" | "skew";

export type TranslateTransform = {
  kind: "translate";
  x: number;
  y: number;
};

export type ScaleTransform = {
  kind: "scale";
  value: number;
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

export type WebKeyframe = {
  time: number;
  opacity: number;
  transforms?: TransformOperation[];
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  skewX?: number;
  skewY?: number;
};

export type NormalizedWebKeyframe = {
  time: number;
  opacity: number;
  transforms: TransformOperation[];
};

export type TranslateUnit = "px" | "vw" | "vh" | "%" | "custom";

export type TranslateConfig = {
  unit: TranslateUnit;
  functionName?: string;
  customUnit?: string;
};

export type WebKeyframesData = {
  id: string;
  duration: number;
  translate?: TranslateConfig;
  keyframes: WebKeyframe[];
};

export type NormalizedTranslateConfig = {
  unit: TranslateUnit;
  functionName: string | null;
  customUnit: string | null;
};

export type NormalizedWebKeyframesData = Omit<WebKeyframesData, "translate" | "keyframes"> & {
  translate: NormalizedTranslateConfig;
  keyframes: NormalizedWebKeyframe[];
};
