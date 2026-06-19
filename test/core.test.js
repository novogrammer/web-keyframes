import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSLATE_CONFIG,
  WebKeyframesValidationError,
  duplicateKeyframes,
  generatePreviewCss,
  generateScss,
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
  translate: { unit: "px" },
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

const baseDocument = {
  timelines: [baseTimeline],
};

test("generateScss renders the expected SCSS for a document", () => {
  const scss = generateScss(baseDocument);

  assert.equal(
    scss,
    `@keyframes hero-logo {\n\n  0% {\n    transform: translate(0px, 40px) scale(1) rotate(0deg);\n    opacity: 0;\n  }\n\n  100% {\n    transform: translate(0px, 0px) scale(1) rotate(0deg);\n    opacity: 1;\n  }\n\n}\n`,
  );
});

test("generateScss concatenates multiple timelines", () => {
  const scss = generateScss({
    timelines: [
      baseTimeline,
      {
        ...baseTimeline,
        id: "hero-shadow",
      },
    ],
  });

  assert.match(scss, /@keyframes hero-logo/);
  assert.match(scss, /@keyframes hero-shadow/);
  assert.match(scss, /}\n\n@keyframes hero-shadow/);
});

test("normalizeWebKeyframesTimeline applies default translate config and sorts keyframes", () => {
  const normalized = normalizeWebKeyframesTimeline({
    ...baseTimeline,
    translate: undefined,
    keyframes: [
      baseTimeline.keyframes[1],
      baseTimeline.keyframes[0],
    ],
  });

  assert.deepEqual(normalized.translate, DEFAULT_TRANSLATE_CONFIG);
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
          { time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 40 }] },
          { time: 600, opacity: null, transforms: null },
          { time: 1200, transforms: [] },
        ],
      },
    ],
  });

  assert.equal(normalized.timelines[0].keyframes[1].opacity, 0);
  assert.deepEqual(normalized.timelines[0].keyframes[1].transforms, [{ kind: "translate", x: 0, y: 40 }]);
  assert.equal(normalized.timelines[0].keyframes[2].opacity, 0);
  assert.deepEqual(normalized.timelines[0].keyframes[2].transforms, []);
});

test("generateScss supports direct units", () => {
  const scss = generateScss({
    timelines: [
      {
        ...baseTimeline,
        translate: { unit: "vw" },
      },
    ],
  });

  assert.match(scss, /translate\(0vw, 40vw\)/);
});

test("generatePreviewCss emits browser-safe transforms", () => {
  const css = generatePreviewCss({
    ...baseTimeline,
  }, "hero-logo__wkf_preview");

  assert.match(css, /@keyframes hero-logo__wkf_preview/);
  assert.match(css, /translate\(0px, 40px\)/);
});

test("generateScss preserves explicit transform order including skew", () => {
  const scss = generateScss({
    timelines: [
      {
        ...baseTimeline,
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
      },
    ],
  });

  assert.match(scss, /transform: rotate\(-6deg\) translate\(0px, 40px\) skew\(8deg, -4deg\)/);
});

test("generateScss omits nullable fields and renders empty transforms as none", () => {
  const scss = generateScss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          { time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 40 }] },
          { time: 600, opacity: null, transforms: null },
          { time: 1200, transforms: [] },
        ],
      },
    ],
  });

  assert.match(scss, /0% {\n    transform: translate\(0px, 40px\);\n    opacity: 0;\n  }/);
  assert.match(scss, /50% {\n  }/);
  assert.match(scss, /100% {\n    transform: none;\n  }/);
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
            keyframes: [{ time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] }],
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
              { time: -1, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] },
              { time: 1201, opacity: 1, transforms: [{ kind: "skew", x: 0, y: "bad" }] },
            ],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].keyframes[0].time must be greater than or equal to 0.") &&
      error.issues.includes("timelines[0].keyframes[1].time must be less than or equal to duration.") &&
      error.issues.includes("timelines[0].keyframes[1].transforms[0].y must be a finite number."),
  );
});

test("validateWebKeyframesDocument allows nullable sparse fields", () => {
  const validated = validateWebKeyframesDocument({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          { time: 0, opacity: 0, transforms: [{ kind: "translate", x: 0, y: 0 }] },
          { time: 600, opacity: null, transforms: null },
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
  assert.equal(nudged.keyframes[0].transforms[0].y, 28);

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
            translate: {
              unit: "custom",
            },
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].translate.customUnit is required when translate.unit is custom."),
  );
});
