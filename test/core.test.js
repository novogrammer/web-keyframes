import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSLATE_CONFIG,
  WebKeyframesValidationError,
  generatePreviewCss,
  generateScss,
  normalizeWebKeyframesData,
  validateWebKeyframesData,
} from "../dist/index.js";

const baseData = {
  id: "hero-logo",
  duration: 1200,
  translate: { unit: "px", functionName: "global.vw" },
  keyframes: [
    { time: 0, x: 0, y: 40, scale: 1, rotate: 0, opacity: 0 },
    { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
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
      { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      { time: 0, x: 0, y: 40, scale: 1, rotate: 0, opacity: 0 },
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

test("generateScss rounds percentages to at most 3 decimals", () => {
  const scss = generateScss({
    ...baseData,
    duration: 3,
    keyframes: [
      { time: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0 },
      { time: 1, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0.5 },
      { time: 3, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
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
        keyframes: [{ time: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0 }],
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
          { time: -1, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0 },
          { time: 1201, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("keyframes[0].time must be greater than or equal to 0.") &&
      error.issues.includes("keyframes[1].time must be less than or equal to duration."),
  );
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
