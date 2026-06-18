import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSLATE_CONFIG,
  WebKeyframesValidationError,
  duplicateKeyframes,
  generatePreviewCss,
  generateScss,
  nudgeTransforms,
  normalizeWebKeyframesData,
  spreadKeyframeTimes,
  staggerKeyframes,
  validateWebKeyframesData,
} from "../dist/index.js";

const baseData = {
  id: "hero-logo",
  duration: 1200,
  translate: { unit: "px", functionName: "global.vw" },
  keyframes: [
    {
      time: 0,
      opacity: 0,
      transforms: [
        { kind: "translate", x: 0, y: 40 },
        { kind: "scale", value: 1 },
        { kind: "rotate", value: 0 },
      ],
    },
    {
      time: 1200,
      opacity: 1,
      transforms: [
        { kind: "translate", x: 0, y: 0 },
        { kind: "scale", value: 1 },
        { kind: "rotate", value: 0 },
      ],
    },
  ],
};

test("generateScss renders the expected SCSS", () => {
  const scss = generateScss(baseData);

  assert.equal(
    scss,
    `@keyframes hero-logo {\n\n  0% {\n    transform: translate(global.vw(0px), global.vw(40px)) scale(1) rotate(0deg);\n    opacity: 0;\n  }\n\n  100% {\n    transform: translate(global.vw(0px), global.vw(0px)) scale(1) rotate(0deg);\n    opacity: 1;\n  }\n\n}\n`,
  );
});

test("normalizeWebKeyframesData applies the default translate config and sorts keyframes", () => {
  const normalized = normalizeWebKeyframesData({
    ...baseData,
    translate: undefined,
    keyframes: [
      baseData.keyframes[1],
      baseData.keyframes[0],
    ],
  });

  assert.deepEqual(normalized.translate, DEFAULT_TRANSLATE_CONFIG);
  assert.deepEqual(
    normalized.keyframes.map((keyframe) => keyframe.time),
    [0, 1200],
  );
});

test("generateScss supports direct units and optional wrapping functions", () => {
  const scss = generateScss({
    ...baseData,
    translate: { unit: "vw" },
  });

  assert.match(scss, /translate\(0vw, 40vw\)/);

  const wrapped = generateScss({
    ...baseData,
    translate: { unit: "%", functionName: "customFn" },
  });

  assert.match(wrapped, /translate\(customFn\(0%\), customFn\(40%\)\)/);
});

test("generatePreviewCss ignores wrapping functions for browser preview", () => {
  const css = generatePreviewCss({
    ...baseData,
    translate: { unit: "px", functionName: "customFn" },
  }, "hero-logo__wkf_preview");

  assert.match(css, /@keyframes hero-logo__wkf_preview/);
  assert.match(css, /translate\(0px, 40px\)/);
  assert.doesNotMatch(css, /customFn/);
});

test("normalizeWebKeyframesData upgrades legacy fixed transform fields", () => {
  const normalized = normalizeWebKeyframesData({
    id: "legacy",
    duration: 500,
    keyframes: [
      { time: 0, x: 10, y: 20, scale: 0.8, rotate: -15, opacity: 0.5 },
      { time: 500, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
    ],
  });

  assert.deepEqual(normalized.keyframes[0].transforms, [
    { kind: "translate", x: 10, y: 20 },
    { kind: "scale", value: 0.8 },
    { kind: "rotate", value: -15 },
  ]);
});

test("generateScss preserves explicit transform order including skew", () => {
  const scss = generateScss({
    ...baseData,
    keyframes: [
      {
        time: 0,
        opacity: 0,
        transforms: [
          { kind: "rotate", value: -6 },
          { kind: "translate", x: 0, y: 40 },
          { kind: "skew", x: 8, y: -4 },
        ],
      },
      {
        time: 1200,
        opacity: 1,
        transforms: [
          { kind: "rotate", value: 0 },
          { kind: "translate", x: 0, y: 0 },
          { kind: "skew", x: 0, y: 0 },
        ],
      },
    ],
  });

  assert.match(scss, /transform: rotate\(-6deg\) translate\(global\.vw\(0px\), global\.vw\(40px\)\) skew\(8deg, -4deg\)/);
});

test("generateScss rounds percentages to at most 3 decimals", () => {
  const scss = generateScss({
    ...baseData,
    duration: 3,
    keyframes: [
      { time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] },
      { time: 1, opacity: 0.5, transforms: [{ kind: "translate", x: 0, y: 0 }] },
      { time: 3, opacity: 1, transforms: [{ kind: "translate", x: 0, y: 0 }] },
    ],
  });

  assert.match(scss, /33\.333%/);
});

test("validateWebKeyframesData rejects missing and invalid required fields", () => {
  assert.throws(
    () =>
      validateWebKeyframesData({
        ...baseData,
        id: "",
        duration: 0,
        keyframes: [{ time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] }],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("id is required.") &&
      error.issues.includes("duration must be a number greater than 0.") &&
      error.issues.includes("keyframes must contain at least 2 items."),
  );
});

test("validateWebKeyframesData rejects out-of-range keyframe times", () => {
  assert.throws(
    () =>
      validateWebKeyframesData({
        ...baseData,
        keyframes: [
          { time: -1, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] },
          { time: 1201, opacity: 1, transforms: [{ kind: "translate", x: 0, y: 0 }] },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("keyframes[0].time must be greater than or equal to 0.") &&
      error.issues.includes("keyframes[1].time must be less than or equal to duration."),
  );
});

test("validateWebKeyframesData rejects invalid transform entries", () => {
  assert.throws(
    () =>
      validateWebKeyframesData({
        ...baseData,
        keyframes: [
          {
            time: 0,
            opacity: 0,
            transforms: [{ kind: "skew", x: 0, y: "bad" }],
          },
          baseData.keyframes[1],
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("keyframes[0].transforms[0].y must be a finite number."),
  );
});

test("edit helpers support duplicate, nudge, spread, and stagger workflows", () => {
  const duplicated = duplicateKeyframes(baseData, [0], 300);
  assert.equal(duplicated.keyframes.length, 3);
  assert.equal(duplicated.keyframes[1].time, 300);

  const nudged = nudgeTransforms(baseData, [0], [0], "y", -12);
  assert.equal(nudged.keyframes[0].transforms[0].y, 28);

  const spread = spreadKeyframeTimes(duplicated, [0, 1, 2], 0, 1200);
  assert.deepEqual(spread.keyframes.map((keyframe) => keyframe.time), [0, 600, 1200]);

  const staggered = staggerKeyframes(baseData, [0, 1], 180, 120);
  assert.deepEqual(staggered.keyframes.map((keyframe) => keyframe.time), [120, 300]);
});

test("validateWebKeyframesData rejects invalid translate settings", () => {
  assert.throws(
    () =>
      validateWebKeyframesData({
        ...baseData,
        translate: {
          unit: "custom",
          functionName: 123,
        },
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("translate.functionName must be a string when provided.") &&
      error.issues.includes("translate.customUnit is required when translate.unit is custom."),
  );
});
