import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSLATE_CONFIG,
  createOpacityProperty,
  createTransformProperty,
  getOpacityValue,
  getTransformOperations,
  normalizeWebKeyframesDocument,
  normalizeWebKeyframesTimeline,
} from "../src/core/normalize.ts";
import {
} from "../src/core/edit.ts";
import { generateCss } from "../src/core/generateCss.ts";
import {
  WebKeyframesValidationError,
  validateWebKeyframesDocument,
} from "../src/core/validate.ts";

const baseTimeline = {
  id: "hero-logo",
  duration: 1200,
  translateConfig: { unit: "px" },
  keyframes: [
    createKeyframe(0, 0, [
      { kind: "translate", x: 0, y: 40 },
      { kind: "scale", x: 1, y: 1 },
      { kind: "rotate", value: 0 },
    ]),
    createKeyframe(1200, 1, [
      { kind: "translate", x: 0, y: 0 },
      { kind: "scale", x: 1, y: 1 },
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
    `@keyframes hero-logo {\n\n  0% {\n    transform: translate(0px, 40px) scale(1, 1) rotate(0deg);\n    opacity: 0;\n  }\n\n  100% {\n    transform: translate(0px, 0px) scale(1, 1) rotate(0deg);\n    opacity: 1;\n  }\n\n}\n`,
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

test("normalizeWebKeyframesDocument preserves sparse properties while normalizing positions", () => {
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

  assert.equal(normalized.timelines[0].keyframes[1].percent, 50);
  assert.equal(getOpacityValue(normalized.timelines[0].keyframes[1]), null);
  assert.deepEqual(getTransformOperations(normalized.timelines[0].keyframes[1]), []);
  assert.equal(getOpacityValue(normalized.timelines[0].keyframes[2]), null);
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

test("generateCss allows empty keyframe lists", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [],
      },
    ],
  });

  assert.equal(css, "@keyframes hero-logo {\n\n}\n");
});

test("generateCss supports percent-based keyframes without duration", () => {
  const css = generateCss({
    timelines: [
      {
        id: "hero-logo",
        positionType: "percent",
        keyframes: [
          { percent: 0, properties: [createOpacityProperty(0)] },
          { percent: 25, properties: [createOpacityProperty(0.5)] },
          { percent: 100, properties: [createOpacityProperty(1)] },
        ],
      },
    ],
  });

  assert.match(css, /0% \{\n    opacity: 0;\n  \}/);
  assert.match(css, /25% \{\n    opacity: 0.5;\n  \}/);
  assert.match(css, /100% \{\n    opacity: 1;\n  \}/);
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

test("generateCss supports non-uniform scale transforms", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          createKeyframe(0, 0, [
            { kind: "scale", x: 1.5, y: 0.5 },
            { kind: "translate", x: 0, y: 40 },
          ]),
          createKeyframe(1200, 1, [
            { kind: "scale", x: 1, y: 1 },
            { kind: "translate", x: 0, y: 0 },
          ]),
        ],
      },
    ],
  });

  assert.match(css, /transform: scale\(1.5, 0.5\) translate\(0px, 40px\)/);
});

test("generateCss emits per-keyframe animation timing functions", () => {
  const css = generateCss({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [
          { ...createKeyframe(0, 0, [{ kind: "translate", x: 0, y: 40 }]), timingFunction: "ease-out" },
          { ...createKeyframe(1200, 1, [{ kind: "translate", x: 0, y: 0 }]), timingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        ],
      },
    ],
  });

  assert.match(css, /0% \{\n    transform: translate\(0px, 40px\);\n    opacity: 0;\n    animation-timing-function: ease-out;\n  \}/);
  assert.match(css, /100% \{\n    transform: translate\(0px, 0px\);\n    opacity: 1;\n    animation-timing-function: cubic-bezier\(0.2, 0.8, 0.2, 1\);\n  \}/);
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
            keyframes: [],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].id is required.") &&
      error.issues.includes("timelines[0].duration must be a number greater than 0 when positionType is time."),
  );
});

test("validateWebKeyframesDocument allows empty keyframe arrays", () => {
  const validated = validateWebKeyframesDocument({
    timelines: [
      {
        ...baseTimeline,
        keyframes: [],
      },
    ],
  });

  assert.equal(validated.timelines[0].keyframes.length, 0);
});

test("validateWebKeyframesDocument rejects duration on percent timelines", () => {
  assert.throws(
    () =>
      validateWebKeyframesDocument({
        timelines: [
          {
            id: "hero-logo",
            positionType: "percent",
            duration: 1200,
            keyframes: [{ percent: 0 }],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].duration must not be provided when positionType is percent."),
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
              createKeyframe(1201, 1, [{ kind: "scale", x: 1, y: "bad" }]),
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

test("validateWebKeyframesDocument rejects empty timingFunction", () => {
  assert.throws(
    () =>
      validateWebKeyframesDocument({
        timelines: [
          {
            ...baseTimeline,
            keyframes: [
              { ...baseTimeline.keyframes[0], timingFunction: "" },
              baseTimeline.keyframes[1],
            ],
          },
        ],
      }),
    (error) =>
      error instanceof WebKeyframesValidationError &&
      error.issues.includes("timelines[0].keyframes[0].timingFunction must be a non-empty string when provided."),
  );
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
