import type {
  RotateTransform,
  ScaleTransform,
  SkewTransform,
  TransformOperation,
  TranslateConfig,
  TranslateTransform,
  WebKeyframe,
  WebKeyframesData,
} from "./types.js";

const TRANSLATE_UNITS = new Set(["px", "vw", "vh", "%", "custom"]);
const TRANSFORM_KINDS = new Set(["translate", "scale", "rotate", "skew"]);

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

  if (typeof candidate.duration !== "number" || !Number.isFinite(candidate.duration) || candidate.duration <= 0) {
    issues.push("duration must be a number greater than 0.");
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

  if (!isFiniteNumber(candidate.time)) {
    issues.push(`keyframes[${index}].time must be a finite number.`);
  }

  if (candidate.opacity !== undefined && candidate.opacity !== null && !isFiniteNumber(candidate.opacity)) {
    issues.push(`keyframes[${index}].opacity must be a finite number.`);
  }

  if (candidate.transforms !== undefined && candidate.transforms !== null && !Array.isArray(candidate.transforms)) {
    issues.push(`keyframes[${index}].transforms must be an array.`);
  } else if (Array.isArray(candidate.transforms)) {
    candidate.transforms.forEach((transform, transformIndex) => {
      issues.push(...validateTransform(transform, index, transformIndex));
    });
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

function validateTransform(transform: unknown, keyframeIndex: number, transformIndex: number): string[] {
  if (!isPlainObject(transform)) {
    return [`keyframes[${keyframeIndex}].transforms[${transformIndex}] must be an object.`];
  }

  const candidate = transform as Partial<TransformOperation>;
  const issues: string[] = [];
  const prefix = `keyframes[${keyframeIndex}].transforms[${transformIndex}]`;

  if (typeof candidate.kind !== "string" || !TRANSFORM_KINDS.has(candidate.kind)) {
    issues.push(`${prefix}.kind must be one of translate, scale, rotate, or skew.`);
    return issues;
  }

  switch (candidate.kind) {
    case "translate":
      issues.push(...validateTranslateTransform(candidate as Partial<TranslateTransform>, prefix));
      break;
    case "scale":
      issues.push(...validateScaleTransform(candidate as Partial<ScaleTransform>, prefix));
      break;
    case "rotate":
      issues.push(...validateRotateTransform(candidate as Partial<RotateTransform>, prefix));
      break;
    case "skew":
      issues.push(...validateSkewTransform(candidate as Partial<SkewTransform>, prefix));
      break;
  }

  return issues;
}

function validateTranslateTransform(transform: Partial<TranslateTransform>, prefix: string): string[] {
  const issues: string[] = [];
  if (!isFiniteNumber(transform.x)) {
    issues.push(`${prefix}.x must be a finite number.`);
  }
  if (!isFiniteNumber(transform.y)) {
    issues.push(`${prefix}.y must be a finite number.`);
  }
  return issues;
}

function validateScaleTransform(transform: Partial<ScaleTransform>, prefix: string): string[] {
  return isFiniteNumber(transform.value) ? [] : [`${prefix}.value must be a finite number.`];
}

function validateRotateTransform(transform: Partial<RotateTransform>, prefix: string): string[] {
  return isFiniteNumber(transform.value) ? [] : [`${prefix}.value must be a finite number.`];
}

function validateSkewTransform(transform: Partial<SkewTransform>, prefix: string): string[] {
  const issues: string[] = [];
  if (!isFiniteNumber(transform.x)) {
    issues.push(`${prefix}.x must be a finite number.`);
  }
  if (!isFiniteNumber(transform.y)) {
    issues.push(`${prefix}.y must be a finite number.`);
  }
  return issues;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
