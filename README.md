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
npm install github:novogrammer/web-keyframes#v0.3.0
```

## Hosted examples

- Basic example: https://novogrammer.github.io/web-keyframes/examples/basic/
- Hero animation example: https://novogrammer.github.io/web-keyframes/examples/hero-animation/

## Editor

```ts
import { WebKeyframesEditor } from "web-keyframes/editor";
import "web-keyframes/editor.css";

const editor = new WebKeyframesEditor({
  root: document.body,
  shortcut: "Ctrl+Shift+K",
});

editor.mount();
```

## CSS generator

```ts
import { generateCss } from "web-keyframes";

const css = generateCss({
  timelines: [
    {
      id: "hero-logo",
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

`generateCss()` is the only root export. `web-keyframes/editor` exposes `WebKeyframesEditor`.

### Available methods

```ts
editor.mount();
editor.unmount();

editor.show();
editor.hide();
editor.toggle();

editor.getData();
editor.setData(data);

editor.toJson();
editor.toCss();
```

### Current editor features

- Manage multiple timelines in one document
- Edit the selected timeline `id`, `positionType`, optional `duration`, and `translateConfig` output settings
- Edit selected keyframe `time` or `percent`, `timingFunction`, `opacity`, and ordered transform entries
- Add, reorder, retarget, and delete `translate`, `scale`, `rotate`, and `skew` transforms
- Add, duplicate, select, and delete timelines
- Add, duplicate, and delete keyframes
- View generated JSON and CSS inside the editor
- Run a lightweight preview against real DOM elements already using the same `animation-name`
- Reset that preview back to the page's original animation name
- Copy JSON
- Copy CSS
- Reset the editor back to default data
- Toggle visibility with an optional shortcut
- Close preview panels with `Escape`

### Current editor limitations

- Preview only works when matching elements already exist in `document` and already use the same `animation-name` as the selected timeline `id`
- No file import or auto-save
- `timingFunction` is free-form text with preset-assisted input, not a structured easing builder

### Preview behavior

The `Preview` button searches the current document for elements whose computed `animation-name`
matches the selected timeline `id`.

When matches are found, the editor:

- generates the same keyframe CSS as export, but under a temporary keyframes name
- injects one preview `<style>` tag at the end of `<head>`
- temporarily swaps matching elements to that preview animation name so the animation reruns

`Reset Preview` removes the temporary style tag and restores the previous inline `animation-name`
value for matched elements.

## Data shape

```json
{
  "timelines": [
    {
      "id": "hero-logo",
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

Each document contains `timelines[]`. Each timeline owns its own `id`, `positionType`, `translateConfig`, and `keyframes`. `duration` exists only for `time` mode timelines.

Timelines support two position modes:

- `time` mode: each keyframe uses `time`, and the timeline must include `duration`
- `percent` mode: each keyframe uses `percent`, and the timeline must not include `duration`

`keyframes` may be an empty array while authoring. This is useful when you add a new timeline and want to build it from scratch in the editor.

Each keyframe expresses animated values through an ordered `properties[]` list. `transform` stores its ordered operations in `value[]`. Top-level legacy fields such as `x`, `y`, `scale`, `rotate`, `skewX`, and `skewY` are no longer accepted.

Each keyframe may also include `timingFunction`. When present, it is emitted directly as a keyframe-local `animation-timing-function`.

`opacity` and `transform` may be omitted from `properties[]` on individual keyframes to match CSS-style sparse keyframe authoring.

- omitted `opacity` property: no `opacity` declaration is emitted for that keyframe
- omitted `transform` property: no `transform` declaration is emitted for that keyframe
- `transform` property with `"value": []`: emits `transform: none;`

The editor preserves sparse keyframes as authored. `getData()` and `toJson()` keep the same sparse shape instead of densifying omitted properties.

## CLI

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

Each input file may contain one or more timelines. When the input is a directory, files are read in filename order and joined with blank lines.

## Output example

```css
@keyframes hero-logo {
  0% {
    transform: translate(0px, 40px) scale(1, 1) rotate(0deg);
    opacity: 0;
    animation-timing-function: ease-out;
  }

  100% {
    transform: translate(0px, 0px) scale(1, 1) rotate(0deg);
    opacity: 1;
  }
}
```

`translateConfig.unit` controls the emitted unit such as `px`, `vw`, `vh`, `%`, or a custom unit token.  
Transform array order is preserved in generated CSS and in editor preview playback.
`scale` always stores `x` and `y`, and CSS output always uses `scale(x, y)`.
`timingFunction` is passed through as-is, so values like `ease`, `linear`, `cubic-bezier(...)`, and `steps(...)` are all valid.
`generateCss()` emits only `@keyframes`. Apply `animation`, `animation-name`, easing, and fill-mode in your own stylesheet.

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
