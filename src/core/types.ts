export type WebKeyframe = {
  time: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
};

export type WebKeyframesData = {
  id: string;
  target: string;
  duration: number;
  designWidth: number;
  unitFunction?: string;
  keyframes: WebKeyframe[];
};

export type NormalizedWebKeyframesData = Omit<WebKeyframesData, "unitFunction"> & {
  unitFunction: string;
};
