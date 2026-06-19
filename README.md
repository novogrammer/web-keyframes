# web-keyframes

English: [README.md](./README.md)  
日本語: [README.ja.md](./README.ja.md)

`web-keyframes` is a lightweight keyframe data editor and SCSS generator for web animation workflows.

It does two things:

- Edit keyframe document JSON in a browser-side overlay editor
- Convert that JSON into SCSS keyframes

This package is intentionally narrow. It does not auto-save files or depend on a specific app bundler.

GitHub installs are expected to build `dist/` during package preparation. The repository does not track built files.

## Install

```bash
npm install github:novogrammer/web-keyframes#v0.1.0
```

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
editor.toScss();
```

### Current editor features

- Manage multiple timelines in one document
- Edit the selected timeline `id`, `duration`, and translate output settings
- Edit selected keyframe `time`, `opacity`, and ordered transform entries
- Add, reorder, retarget, and delete `translate`, `scale`, `rotate`, and `skew` transforms
- Add, duplicate, select, and delete timelines
- Add, duplicate, and delete keyframes
- View generated JSON and SCSS inside the editor
- Run a lightweight preview against real DOM elements already using the same `animation-name`
- Reset that preview back to the page's original animation name
- Copy JSON
- Copy SCSS
- Reset the editor back to default data
- Toggle visibility with an optional shortcut
- Close preview panels with `Escape`

### Current editor limitations

- Preview only works when matching elements already exist in `document` and already use the same `animation-name` as the selected timeline `id`
- No file import or auto-save
- No easing editor yet

### Preview behavior

The `Preview` button searches the current document for elements whose computed `animation-name`
matches the selected timeline `id`.

When matches are found, the editor:

- generates browser-safe preview CSS with a temporary keyframes name
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
      "translate": {
        "unit": "px"
      },
      "keyframes": [
        {
          "time": 0,
          "opacity": 0,
          "transforms": [
            { "kind": "translate", "x": 0, "y": 40 },
            { "kind": "scale", "value": 1 },
            { "kind": "rotate", "value": 0 }
          ]
        },
        {
          "time": 1200,
          "opacity": 1,
          "transforms": [
            { "kind": "translate", "x": 0, "y": 0 },
            { "kind": "scale", "value": 1 },
            { "kind": "rotate", "value": 0 }
          ]
        }
      ]
    }
  ]
}
```

Each document contains `timelines[]`. Each timeline owns its own `id`, `duration`, `translate`, and `keyframes`.

When a keyframe specifies `transforms`, it uses an ordered array. Top-level legacy fields such as `x`, `y`, `scale`, `rotate`, `skewX`, and `skewY` are no longer accepted.

`opacity` and `transforms` may be omitted or set to `null` on individual keyframes to match CSS-style sparse keyframe authoring.

- omitted or `null` `opacity`: no `opacity` declaration is emitted for that keyframe
- omitted or `null` `transforms`: no `transform` declaration is emitted for that keyframe
- `transforms: []`: emits `transform: none;`

Internal editing helpers still resolve sparse values against the previous keyframe so editor interactions stay deterministic.

## CLI

Convert one file:

```bash
web-keyframes to-scss \
  --input src/animations/hero-logo.timeline.json \
  --output src/assets/css/generated/_hero-logo.scss
```

Convert a directory of `*.timeline.json` files into one SCSS file:

```bash
web-keyframes to-scss \
  --input src/animations \
  --output src/assets/css/generated/_animations.generated.scss
```

Each input file may contain one or more timelines. When the input is a directory, files are read in filename order and joined with blank lines.

## Output example

```scss
@keyframes hero-logo {
  0% {
    transform: translate(global.vw(0px), global.vw(40px)) scale(1) rotate(0deg);
    opacity: 0;
  }

  100% {
    transform: translate(global.vw(0px), global.vw(0px)) scale(1) rotate(0deg);
    opacity: 1;
  }
}
```

`translate.unit` controls the emitted unit such as `px`, `vw`, `vh`, `%`, or a custom unit token.  
Transform array order is preserved exactly in both `generateScss()` and `generatePreviewCss()`.
`generateScss()` emits only `@keyframes`. Apply `animation`, `animation-name`, easing, and fill-mode in your own stylesheet.
`generatePreviewCss()` emits browser-safe preview CSS.

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
