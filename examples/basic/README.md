# basic example

This example is a minimal consumer project for `web-keyframes`.

## Install

```bash
cd examples/basic
npm install
```

## Run the example page

```bash
npm run dev
```

Then open the served URL and use:

- `Ctrl+Shift+K` to toggle the editor
- `Toggle editor` button to open and close the overlay
- `Log JSON` / `Log SCSS` to inspect generated output in the browser console

## Generate SCSS from sample timeline JSON

```bash
npm run gen:scss
```

This writes the output to `src/generated/_animations.generated.scss`.
