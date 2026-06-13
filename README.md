# web-keyframes

`web-keyframes` is a lightweight keyframe data editor and SCSS generator for web animation workflows.

It does two things:

- Edit timeline JSON in a browser-side overlay editor
- Convert that JSON into SCSS keyframes and animation rules

This package is intentionally narrow. It does not preview animations on live DOM nodes, auto-save files, or depend on a specific app bundler.

## Install

```bash
npm install github:YOUR_NAME/web-keyframes#v0.1.0
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

- Edit `id`, `target`, `duration`, `designWidth`, and `unitFunction`
- Edit keyframe `time`, `x`, `y`, `scale`, `rotate`, and `opacity`
- Add and delete keyframes
- Copy JSON
- Copy SCSS
- Toggle visibility with an optional shortcut

### Current editor limitations

- No preview against real DOM elements
- No file import or auto-save
- No easing editor yet
- No multi-timeline management

## Data shape

```json
{
  "id": "hero-logo",
  "target": ".js-hero-logo",
  "duration": 1200,
  "designWidth": 1440,
  "unitFunction": "global.vw",
  "keyframes": [
    {
      "time": 0,
      "x": 0,
      "y": 40,
      "scale": 1,
      "rotate": 0,
      "opacity": 0
    },
    {
      "time": 1200,
      "x": 0,
      "y": 0,
      "scale": 1,
      "rotate": 0,
      "opacity": 1
    }
  ]
}
```

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

When the input is a directory, files are read in filename order and joined with blank lines.

## Output example

```scss
@keyframes hero-logo {
  0% {
    transform: translate(global.vw(0), global.vw(40)) scale(1) rotate(0deg);
    opacity: 0;
  }

  100% {
    transform: translate(global.vw(0), global.vw(0)) scale(1) rotate(0deg);
    opacity: 1;
  }
}

.js-hero-logo {
  animation: hero-logo 1200ms ease-out forwards;
}
```

## Development

```bash
npm install
npm run build
npm run typecheck
node --test
```
