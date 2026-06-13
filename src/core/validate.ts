import type { TranslateConfig, WebKeyframe, WebKeyframesData } from "./types.js";

const KEYFRAME_FIELDS = ["time", "x", "y", "scale", "rotate", "opacity"] as const;
const TRANSLATE_UNITS = new Set(["px", "vw", "vh", "%", "custom"]);

export class WebKeyframesValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "WebKeyframesValidationError";
    this.issues = issues;
  }
}

export function validateWebKeyframesData(data: unknown): WebKeyframesData {
  const issues: string[] = [];

  if (!isPlainObject(data)) {
    throw new WebKeyframesValidationError(["Data must be an object."]);
  }

  const candidate = data as Partial<WebKeyframesData>;

  if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
    issues.push("id is required.");
  }

  if (typeof candidate.target !== "string" || candidate.target.trim() === "") {
    issues.push("target is required.");
  }

  if (typeof candidate.duration !== "number" || !Number.isFinite(candidate.duration) || candidate.duration <= 0) {
    issues.push("duration must be a number greater than 0.");
  }

  if (typeof candidate.designWidth !== "number" || !Number.isFinite(candidate.designWidth)) {
    issues.push("designWidth must be a finite number.");
  }

  if (candidate.translate !== undefined) {
    issues.push(...validateTranslate(candidate.translate));
  }

  if (!Array.isArray(candidate.keyframes)) {
    issues.push("keyframes must be an array.");
  } else {
    if (candidate.keyframes.length < 2) {
      issues.push("keyframes must contain at least 2 items.");
    }

    candidate.keyframes.forEach((keyframe, index) => {
      issues.push(...validateKeyframe(keyframe, index, candidate.duration));
    });
  }

  if (issues.length > 0) {
    throw new WebKeyframesValidationError(issues);
  }

  return candidate as WebKeyframesData;
}

function validateTranslate(translate: unknown): string[] {
  if (!isPlainObject(translate)) {
    return ["translate must be an object when provided."];
  }

  const candidate = translate as Partial<TranslateConfig>;
  const issues: string[] = [];

  if (typeof candidate.unit !== "string" || !TRANSLATE_UNITS.has(candidate.unit)) {
    issues.push("translate.unit must be one of px, vw, vh, %, or custom.");
  }

  if (candidate.functionName !== undefined && typeof candidate.functionName !== "string") {
    issues.push("translate.functionName must be a string when provided.");
  }

  if (candidate.customUnit !== undefined && typeof candidate.customUnit !== "string") {
    issues.push("translate.customUnit must be a string when provided.");
  }

  if (candidate.unit === "custom" && (!candidate.customUnit || candidate.customUnit.trim() === "")) {
    issues.push("translate.customUnit is required when translate.unit is custom.");
  }

  return issues;
}

function validateKeyframe(
  keyframe: unknown,
  index: number,
  duration: number | undefined,
): string[] {
  if (!isPlainObject(keyframe)) {
    return [`keyframes[${index}] must be an object.`];
  }

  const candidate = keyframe as Partial<WebKeyframe>;
  const issues: string[] = [];

  for (const field of KEYFRAME_FIELDS) {
    const value = candidate[field];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`keyframes[${index}].${field} must be a finite number.`);
    }
  }

  if (typeof candidate.time === "number") {
    if (candidate.time < 0) {
      issues.push(`keyframes[${index}].time must be greater than or equal to 0.`);
    }

    if (typeof duration === "number" && Number.isFinite(duration) && candidate.time > duration) {
      issues.push(`keyframes[${index}].time must be less than or equal to duration.`);
    }
  }

  return issues;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
