import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_UNIT_FUNCTION,
  WebKeyframesValidationError,
  generateScss,
  normalizeWebKeyframesData,
  validateWebKeyframesData,
} from "../dist/index.js";

const baseData = {
  id: "hero-logo",
  target: ".js-hero-logo",
  duration: 1200,
  designWidth: 1440,
  unitFunction: "global.vw",
  keyframes: [
    { time: 0, x: 0, y: 40, scale: 1, rotate: 0, opacity: 0 },
    { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
  ],
};

test("generateScss renders the expected SCSS", () => {
  const scss = generateScss(baseData);

  assert.equal(
    scss,
    `@keyframes hero-logo {\n\n  0% {\n    transform: translate(global.vw(0), global.vw(40)) scale(1) rotate(0deg);\n    opacity: 0;\n  }\n\n  100% {\n    transform: translate(global.vw(0), global.vw(0)) scale(1) rotate(0deg);\n    opacity: 1;\n  }\n\n}\n\n.js-hero-logo {\n  animation: hero-logo 1200ms ease-out forwards;\n}\n`,
  );
});

test("normalizeWebKeyframesData applies the default unit function and sorts keyframes", () => {
  const normalized = normalizeWebKeyframesData({
    ...baseData,
    unitFunction: "",
    keyframes: [
      { time: 1200, x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
      { time: 0, x: 0, y: 40, scale: 1, rotate: 0, opacity: 0 },
    ],
  });

  assert.equal(normalized.unitFunction, DEFAULT_UNIT_FUNCTION);
  assert.deepEqual(
    normalized.keyframes.map((keyframe) => keyframe.time),
    [0, 1200],
  );
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
        target: "",
        duration: 0,
        keyframes: [{ time: 0, x: 0, y: 0, scale: 1, rotate: 0, opacity: 0 }],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("id is required.") &&
      error.issues.includes("target is required.") &&
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
