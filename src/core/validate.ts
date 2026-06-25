import type {
  KeyframePositionMode,
  KeyframeProperty,
  OpacityProperty,
  RotateTransform,
  ScaleTransform,
  SkewTransform,
  TransformOperation,
  TransformProperty,
  TranslateConfig,
  TranslateTransform,
  WebKeyframe,
  WebKeyframesDocument,
  WebKeyframesTimeline,
} from "./types.js";

const TRANSLATE_UNITS = new Set(["px", "vw", "vh", "%", "custom"]);
const TRANSFORM_KINDS = new Set(["translate", "scale", "rotate", "skew"]);
const PROPERTY_KINDS = new Set(["opacity", "transform"]);

class WebKeyframesValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "WebKeyframesValidationError";
    this.issues = issues;
  }
}

export function validateWebKeyframesDocument(data: unknown): WebKeyframesDocument {
  const issues: string[] = [];

  if (!isPlainObject(data)) {
    throw new WebKeyframesValidationError(["Data must be an object."]);
  }

  const candidate = data as Partial<WebKeyframesDocument>;

  if (!Array.isArray(candidate.timelines)) {
    issues.push("timelines must be an array.");
  } else {
    if (candidate.timelines.length < 1) {
      issues.push("timelines must contain at least 1 item.");
    }

    candidate.timelines.forEach((timeline, index) => {
      issues.push(...validateTimeline(timeline, index));
    });
  }

  if (issues.length > 0) {
    throw new WebKeyframesValidationError(issues);
  }

  return candidate as WebKeyframesDocument;
}

export function validateWebKeyframesTimeline(data: unknown): WebKeyframesTimeline {
  const issues = validateTimeline(data, null);
  if (issues.length > 0) {
    throw new WebKeyframesValidationError(issues);
  }

  return data as WebKeyframesTimeline;
}

function validateTimeline(timeline: unknown, timelineIndex: number | null): string[] {
  if (!isPlainObject(timeline)) {
    return [withTimelinePrefix("timeline must be an object.", timelineIndex)];
  }

  const candidate = timeline as Partial<WebKeyframesTimeline>;
  const issues: string[] = [];
  const prefix = timelineIndex === null ? "" : `timelines[${timelineIndex}].`;
  const positionType = resolveTimelinePositionType(candidate);

  if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
    issues.push(`${prefix}id is required.`);
  }

  if (candidate.positionType !== undefined && candidate.positionType !== "time" && candidate.positionType !== "percent") {
    issues.push(`${prefix}positionType must be either time or percent when provided.`);
  }

  if (positionType === "time") {
    if (typeof candidate.duration !== "number" || !Number.isFinite(candidate.duration) || candidate.duration <= 0) {
      issues.push(`${prefix}duration must be a number greater than 0 when positionType is time.`);
    }
  } else if (candidate.duration !== undefined) {
    issues.push(`${prefix}duration must not be provided when positionType is percent.`);
  }

  if (candidate.translateConfig !== undefined) {
    issues.push(...validateTranslate(candidate.translateConfig, prefix));
  }

  if (!Array.isArray(candidate.keyframes)) {
    issues.push(`${prefix}keyframes must be an array.`);
  } else {
    candidate.keyframes.forEach((keyframe, index) => {
      issues.push(...validateKeyframe(keyframe, index, positionType, candidate.duration, prefix));
    });
  }

  return issues;
}

function validateTranslate(translate: unknown, prefix: string): string[] {
  if (!isPlainObject(translate)) {
    return [`${prefix}translateConfig must be an object when provided.`];
  }

  const candidate = translate as Partial<TranslateConfig>;
  const issues: string[] = [];

  if (typeof candidate.unit !== "string" || !TRANSLATE_UNITS.has(candidate.unit)) {
    issues.push(`${prefix}translateConfig.unit must be one of px, vw, vh, %, or custom.`);
  }

  if (candidate.customUnit !== undefined && typeof candidate.customUnit !== "string") {
    issues.push(`${prefix}translateConfig.customUnit must be a string when provided.`);
  }

  if (candidate.unit === "custom" && (!candidate.customUnit || candidate.customUnit.trim() === "")) {
    issues.push(`${prefix}translateConfig.customUnit is required when translateConfig.unit is custom.`);
  }

  return issues;
}

function validateKeyframe(
  keyframe: unknown,
  index: number,
  positionType: KeyframePositionMode,
  duration: number | undefined,
  prefix: string,
): string[] {
  const keyframePrefix = `${prefix}keyframes[${index}]`;

  if (!isPlainObject(keyframe)) {
    return [`${keyframePrefix} must be an object.`];
  }

  const candidate = keyframe as Partial<WebKeyframe>;
  const issues: string[] = [];

  if (positionType === "time") {
    if (!isFiniteNumber(candidate.time)) {
      issues.push(`${keyframePrefix}.time must be a finite number when positionType is time.`);
    }
    if (candidate.percent !== undefined) {
      issues.push(`${keyframePrefix}.percent must not be provided when positionType is time.`);
    }
  } else {
    if (!isFiniteNumber(candidate.percent)) {
      issues.push(`${keyframePrefix}.percent must be a finite number when positionType is percent.`);
    }
    if (candidate.time !== undefined) {
      issues.push(`${keyframePrefix}.time must not be provided when positionType is percent.`);
    }
  }

  if (candidate.timingFunction !== undefined) {
    if (typeof candidate.timingFunction !== "string" || candidate.timingFunction.trim() === "") {
      issues.push(`${keyframePrefix}.timingFunction must be a non-empty string when provided.`);
    }
  }

  if (candidate.properties !== undefined && !Array.isArray(candidate.properties)) {
    issues.push(`${keyframePrefix}.properties must be an array.`);
  } else if (Array.isArray(candidate.properties)) {
    const seenKinds = new Set<string>();
    candidate.properties.forEach((property, propertyIndex) => {
      issues.push(...validateProperty(property, keyframePrefix, propertyIndex));
      if (isPlainObject(property) && typeof property.kind === "string" && PROPERTY_KINDS.has(property.kind)) {
        if (seenKinds.has(property.kind)) {
          issues.push(`${keyframePrefix}.properties must not contain duplicate ${property.kind} items.`);
        }
        seenKinds.add(property.kind);
      }
    });
  }

  if (positionType === "time" && typeof candidate.time === "number") {
    if (candidate.time < 0) {
      issues.push(`${keyframePrefix}.time must be greater than or equal to 0.`);
    }

    if (typeof duration === "number" && Number.isFinite(duration) && candidate.time > duration) {
      issues.push(`${keyframePrefix}.time must be less than or equal to duration.`);
    }
  }

  if (positionType === "percent" && typeof candidate.percent === "number") {
    if (candidate.percent < 0) {
      issues.push(`${keyframePrefix}.percent must be greater than or equal to 0.`);
    }

    if (candidate.percent > 100) {
      issues.push(`${keyframePrefix}.percent must be less than or equal to 100.`);
    }
  }

  return issues;
}

function resolveTimelinePositionType(candidate: Partial<WebKeyframesTimeline>): KeyframePositionMode {
  if (candidate.positionType === "time" || candidate.positionType === "percent") {
    return candidate.positionType;
  }

  if (Array.isArray(candidate.keyframes) && candidate.keyframes.some((keyframe) => isPlainObject(keyframe) && "percent" in keyframe)) {
    return "percent";
  }

  return "time";
}

function validateProperty(property: unknown, keyframePrefix: string, propertyIndex: number): string[] {
  if (!isPlainObject(property)) {
    return [`${keyframePrefix}.properties[${propertyIndex}] must be an object.`];
  }

  const candidate = property as Partial<KeyframeProperty>;
  const prefix = `${keyframePrefix}.properties[${propertyIndex}]`;

  if (typeof candidate.kind !== "string" || !PROPERTY_KINDS.has(candidate.kind)) {
    return [`${prefix}.kind must be one of opacity or transform.`];
  }

  switch (candidate.kind) {
    case "opacity":
      return validateOpacityProperty(candidate as Partial<OpacityProperty>, prefix);
    case "transform":
      return validateTransformProperty(candidate as Partial<TransformProperty>, prefix);
  }
}

function validateOpacityProperty(property: Partial<OpacityProperty>, prefix: string): string[] {
  return isFiniteNumber(property.value) ? [] : [`${prefix}.value must be a finite number.`];
}

function validateTransformProperty(property: Partial<TransformProperty>, prefix: string): string[] {
  if (!Array.isArray(property.value)) {
    return [`${prefix}.value must be an array.`];
  }

  const issues: string[] = [];
  property.value.forEach((transform, transformIndex) => {
    issues.push(...validateTransform(transform, `${prefix}.value`, transformIndex));
  });
  return issues;
}

function validateTransform(transform: unknown, keyframePrefix: string, transformIndex: number): string[] {
  if (!isPlainObject(transform)) {
    return [`${keyframePrefix}[${transformIndex}] must be an object.`];
  }

  const candidate = transform as Partial<TransformOperation>;
  const issues: string[] = [];
  const prefix = `${keyframePrefix}[${transformIndex}]`;

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
  const issues: string[] = [];
  if (!isFiniteNumber(transform.x)) {
    issues.push(`${prefix}.x must be a finite number.`);
  }
  if (!isFiniteNumber(transform.y)) {
    issues.push(`${prefix}.y must be a finite number.`);
  }
  return issues;
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

function withTimelinePrefix(message: string, timelineIndex: number | null): string {
  return timelineIndex === null ? message : `timelines[${timelineIndex}].${message}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
