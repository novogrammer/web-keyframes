import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSLATE_CONFIG,
  WebKeyframesValidationError,
  createOpacityProperty,
  createTransformProperty,
  duplicateKeyframes,
  generateCss,
  generatePreviewCss,
  getOpacityValue,
  getTransformOperations,
  nudgeTransforms,
  normalizeWebKeyframesDocument,
  normalizeWebKeyframesTimeline,
  spreadKeyframeTimes,
  staggerKeyframes,
  validateWebKeyframesDocument,
} from "../dist/index.js";

const baseTimeline = {
  id: "hero-logo",
  duration: 1200,
  translateConfig: { unit: "px" },
  keyframes: [
    createKeyframe(0, 0, [
      { kind: "translate", x: 0, y: 40 },
      { kind: "scale", value: 1 },
      { kind: "rotate", value: 0 },
    ]),
    createKeyframe(1200, 1, [
      { kind: "translate", x: 0, y: 0 },
      { kind: "scale", value: 1 },
      { kind: "rotate", value: 0 },
    ]),
  ],
};

const baseDocument = {
  timelines: [baseTimeline],
};

test("generateCss renders the expected CSS for a document", () => {
  const css = generateCss(baseDocument);

  assert.equal(
    css,
    `@keyframes hero-logo {\n\n  0% {\n    transform: translate(0px, 40px) scale(1) rotate(0deg);\n    opacity: 0;\n  }\n\n  100% {\n    transform: translate(0px, 0px) scale(1) rotate(0deg);\n    opacity: 1;\n  }\n\n}\n`,
  );
});

test("generateCss concatenates multiple timelines", () => {
  const css = generateCss({
    timelines: [
      baseTimeline,
      {
        ...baseTimeline,
        id: "hero-shadow",
      },
    ],
  });

  assert.match(css, /@keyframes hero-logo/);
  assert.match(css, /@keyframes hero-shadow/);
  assert.match(css, /}\n\n@keyframes hero-shadow/);
});

test("normalizeWebKeyframesTimeline applies default translate config and sorts keyframes", () => {
  const normalized = normalizeWebKeyframesTimeline({
    ...baseTimeline,
    translateConfig: undefined,
    keyframes: [
      baseTimeline.keyframes[1],
      baseTimeline.keyframes[0],
    ],
  });

  assert.deepEqual(normalized.translateConfig, DEFAULT_TRANSLATE_CONFIG);
  assert.deepEqual(
    normalized.keyframes.map((keyframe) => keyframe.time),
    [0, 1200],
  );
});

test("normalizeWebKeyframesDocument resolves sparse values per timeline", () => {
  const normalized = normalizeWebKeyframesDocument({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          createKeyframe(0, 0, [{ kind: "translate", x: 0, y: 40 }]),
          { time: 600 },
          { time: 1200, properties: [createTransformProperty([])] },
        ],
      },
    ],
  });

  assert.equal(getOpacityValue(normalized.timelines[0].keyframes[1]), 0);
  assert.deepEqual(getTransformOperations(normalized.timelines[0].keyframes[1]), [{ kind: "translate", x: 0, y: 40 }]);
  assert.equal(getOpacityValue(normalized.timelines[0].keyframes[2]), 0);
  assert.deepEqual(getTransformOperations(normalized.timelines[0].keyframes[2]), []);
});

test("generateCss supports direct units", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        translateConfig: { unit: "vw" },
      },
    ],
  });

  assert.match(css, /translate\(0vw, 40vw\)/);
});

test("generatePreviewCss emits browser-safe transforms", () => {
  const css = generatePreviewCss({
    ...baseTimeline,
  }, "hero-logo__wkf_preview");

  assert.match(css, /@keyframes hero-logo__wkf_preview/);
  assert.match(css, /translate\(0px, 40px\)/);
});

test("generateCss preserves explicit transform order including skew", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          {
            ...createKeyframe(0, 0, [
              { kind: "rotate", value: -6 },
              { kind: "translate", x: 0, y: 40 },
              { kind: "skew", x: 8, y: -4 },
            ]),
          },
          {
            ...createKeyframe(1200, 1, [
              { kind: "rotate", value: 0 },
              { kind: "translate", x: 0, y: 0 },
              { kind: "skew", x: 0, y: 0 },
            ]),
          },
        ],
      },
    ],
  });

  assert.match(css, /transform: rotate\(-6deg\) translate\(0px, 40px\) skew\(8deg, -4deg\)/);
});

test("generateCss omits nullable fields and renders empty transforms as none", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          createKeyframe(0, 0, [{ kind: "translate", x: 0, y: 40 }]),
          { time: 600 },
          { time: 1200, properties: [createTransformProperty([])] },
        ],
      },
    ],
  });

  assert.match(css, /0% {\n    transform: translate\(0px, 40px\);\n    opacity: 0;\n  }/);
  assert.match(css, /50% {\n  }/);
  assert.match(css, /100% {\n    transform: none;\n  }/);
});

test("validateWebKeyframesDocument rejects missing and invalid required fields", () => {
  assert.throws(
    () =>
      validateWebKeyframesDocument({
        timelines: [
          {
            ...baseTimeline,
            id: "",
            duration: 0,
            keyframes: [createKeyframe(0, 0, [{ kind: "translate", x: 0, y: 0 }])],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].id is required.") &&
      error.issues.includes("timelines[0].duration must be a number greater than 0.") &&
      error.issues.includes("timelines[0].keyframes must contain at least 2 items."),
  );
});

test("validateWebKeyframesDocument rejects out-of-range keyframe times and invalid transforms", () => {
  assert.throws(
    () =>
      validateWebKeyframesDocument({
        timelines: [
          {
            ...baseTimeline,
            keyframes: [
              createKeyframe(-1, 0, [{ kind: "translate", x: 0, y: 0 }]),
              createKeyframe(1201, 1, [{ kind: "skew", x: 0, y: "bad" }]),
            ],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].keyframes[0].time must be greater than or equal to 0.") &&
      error.issues.includes("timelines[0].keyframes[1].time must be less than or equal to duration.") &&
      error.issues.includes("timelines[0].keyframes[1].properties[1].value[0].y must be a finite number."),
  );
});

test("validateWebKeyframesDocument allows nullable sparse fields", () => {
  const validated = validateWebKeyframesDocument({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          createKeyframe(0, 0, [{ kind: "translate", x: 0, y: 0 }]),
          { time: 600 },
          { time: 1200 },
        ],
      },
    ],
  });

  assert.equal(validated.timelines[0].keyframes.length, 3);
});

test("timeline edit helpers support duplicate, nudge, spread, and stagger workflows", () => {
  const duplicated = duplicateKeyframes(baseTimeline, [0], 300);
  assert.equal(duplicated.keyframes.length, 3);
  assert.equal(duplicated.keyframes[1].time, 300);

  const nudged = nudgeTransforms(baseTimeline, [0], [0], "y", -12);
  assert.equal(getTransformOperations(nudged.keyframes[0])[0].y, 28);

  const spread = spreadKeyframeTimes(duplicated, [0, 1, 2], 0, 1200);
  assert.deepEqual(spread.keyframes.map((keyframe) => keyframe.time), [0, 600, 1200]);

  const staggered = staggerKeyframes(baseTimeline, [0, 1], 180, 120);
  assert.deepEqual(staggered.keyframes.map((keyframe) => keyframe.time), [120, 300]);
});

test("validateWebKeyframesDocument rejects invalid translate settings", () => {
  assert.throws(
    () =>
      validateWebKeyframesDocument({
        timelines: [
          {
            ...baseTimeline,
            translateConfig: {
              unit: "custom",
            },
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].translateConfig.customUnit is required when translateConfig.unit is custom."),
  );
});

function createKeyframe(time, opacity, transforms) {
  const properties = [];
  if (opacity !== undefined) {
    properties.push(createOpacityProperty(opacity));
  }
  if (transforms !== undefined) {
    properties.push(createTransformProperty(transforms));
  }

  return { time, properties };
}
