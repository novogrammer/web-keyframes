# web-keyframes

English: [README.md](./README.md)  
日本語: [README.ja.md](./README.ja.md)

`web-keyframes` is a lightweight keyframe data editor and CSS generator for web animation workflows.

It does two things:

- Edit keyframe document JSON in a browser-side overlay editor
- Convert that JSON into CSS keyframes

This package is intentionally narrow. It does not auto-save files or depend on a specific app bundler.

One practical advantage is that the final artifact can stay as plain CSS. You can use the
editor and timeline JSON while authoring, then ship only generated `@keyframes` output in
production without carrying editor or JSON runtime overhead.

GitHub installs are expected to build `dist/` during package preparation. The repository does not track built files.

## Install

```bash
npm install github:novogrammer/web-keyframes#v0.4.0
```

## Hosted examples

- Basic example: https://novogrammer.github.io/web-keyframes/examples/basic/
- Hero animation example: https://novogrammer.github.io/web-keyframes/examples/hero-animation/

## Basic workflow

1. Author or edit a timeline document in the browser editor
2. Review and copy JSON or CSS directly in the editor UI, or convert the same document with the API or the CLI
3. Ship only the generated `@keyframes` in production if you want

`generateCss()` only emits `@keyframes`. You still control `animation`, easing, fill mode,
and timing from your own stylesheet.

`timeline.animationName` is the CSS animation name. Generated `@keyframes` and editor preview
both use `animationName`.

## Basic usage

### Editor

```ts
import { WebKeyframesEditor } from "web-keyframes/editor";
import "web-keyframes/editor.css";

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
});

editor.mount();
```

The editor UI can show generated JSON and CSS and lets you copy them without wiring the API or CLI first.
The overlay editor is implemented with `preact` internally, but the public editor API stays small and DOM-oriented.
When you load `web-keyframes/editor` directly in the browser, the distributed `editor.js` already bundles that internal `preact` runtime. You do not need to add a separate import map entry for `preact`.

## Convert To CSS

You can get CSS in three ways: directly from the editor, from application code, or from the command line.

### Editor UI

Open the overlay editor, edit the timeline, then use the built-in JSON and CSS panels to review
or copy the current output.

### API

```ts
import { generateCss } from "web-keyframes";

const css = generateCss({
  timelines: [
    {
      animationName: "hero-logo",
      positionType: "time",
      duration: 1200,
      keyframes: [
        {
          time: 0,
          properties: [
            { kind: "opacity", value: 0 },
            {
              kind: "transform",
              value: [
                { kind: "translate", x: 0, y: 40 },
                { kind: "scale", x: 1, y: 1 },
                { kind: "rotate", value: 0 }
              ]
            }
          ]
        },
        {
          time: 1200,
          properties: [
            { kind: "opacity", value: 1 }
          ]
        }
      ]
    }
  ]
});
```

### CLI

Convert one file:

```bash
web-keyframes to-css \
  --input src/animations/hero-logo.timeline.json \
  --output src/assets/css/generated/hero-logo.css
```

Convert a directory of `*.timeline.json` files into one CSS file:

```bash
web-keyframes to-css \
  --input src/animations \
  --output src/assets/css/generated/animations.css
```

Each input file may contain one or more timelines. When the input is a directory, files are
read in filename order and joined with blank lines.

### Apply the generated keyframes

```css
.hero-logo {
  animation: hero-logo 1200ms ease-out both;
}
```

## Public API

The package keeps its surface area intentionally small.

- Root export: `generateCss()`
- Editor export: `WebKeyframesEditor` from `web-keyframes/editor`

### Editor methods

```ts
editor.mount();
editor.unmount();

editor.show();
editor.hide();
editor.toggle();

editor.getData();
editor.setData(data);

`initialData` and `setData()` expect valid timeline JSON and throw when validation fails.

editor.toJson();
editor.toCss();
```

## Timeline JSON

```json
{
  "timelines": [
    {
      "animationName": "hero-logo",
      "positionType": "time",
      "duration": 1200,
      "translateConfig": {
        "unit": "px"
      },
      "keyframes": [
        {
          "time": 0,
          "timingFunction": "ease-out",
          "properties": [
            { "kind": "opacity", "value": 0 },
            {
              "kind": "transform",
              "value": [
                { "kind": "translate", "x": 0, "y": 40 },
                { "kind": "scale", "x": 1, "y": 1 },
                { "kind": "rotate", "value": 0 }
              ]
            }
          ]
        },
        {
          "time": 1200,
          "properties": [
            { "kind": "opacity", "value": 1 },
            {
              "kind": "transform",
              "value": [
                { "kind": "translate", "x": 0, "y": 0 },
                { "kind": "scale", "x": 1, "y": 1 },
                { "kind": "rotate", "value": 0 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Each document contains `timelines[]`. Each timeline owns its own `animationName`,
`positionType`, `translateConfig`, and `keyframes`.

- `animationName`: CSS animation name used for generated `@keyframes` and editor preview
- `positionType`: required timeline position mode; use `time` or `percent`
- `translateConfig.unit`: one of `px`, `vw`, `vh`, `vmin`, `vmax`, `%`, `em`, or `rem`

Timelines support two position modes:

- `time` mode: each keyframe uses `time`, and the timeline must include `duration`
- `percent` mode: each keyframe uses `percent`, and the timeline must not include `duration`

This JSON is a lightweight intermediate format for generating CSS `@keyframes`, not a dense
snapshot format. Each keyframe only needs to describe the properties that should be emitted at
that position.

`properties` and `timingFunction` are optional on each keyframe. If a property is omitted, that
keyframe simply does not emit that CSS property.

Each keyframe expresses animated values through an ordered `properties[]` list when properties are
present. `transform` stores its ordered operations in `value[]`, and that order is preserved in
generated CSS.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

## Release

- Change history: [CHANGELOG.md](./CHANGELOG.md)
- Maintainer release steps: [docs/release.md](./docs/release.md)
- 日本語のリリース手順: [docs/release.ja.md](./docs/release.ja.md)
