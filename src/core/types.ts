export type WebKeyframe = {
  time: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};

export type TranslateUnit = "px" | "vw" | "vh" | "%" | "custom";

export type TranslateConfig = {
  unit: TranslateUnit;
  functionName?: string;
  customUnit?: string;
};

export type WebKeyframesData = {
  id: string;
  target: string;
  duration: number;
  designWidth: number;
  translate?: TranslateConfig;
  keyframes: WebKeyframe[];
};

export type NormalizedTranslateConfig = {
  unit: TranslateUnit;
  functionName: string | null;
  customUnit: string | null;
};

export type NormalizedWebKeyframesData = Omit<WebKeyframesData, "translate"> & {
  translate: NormalizedTranslateConfig;
};
