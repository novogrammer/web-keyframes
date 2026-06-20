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
- The `WKF` card is animated by a hand-written `animation` rule that references generated keyframes

## Build generated styles

```bash
npm run build
```

This writes:

- `dist/index.html`
- `dist/main.js`
- `dist/animations/*`
- `dist/generated/animations.css`
- `dist/generated/example.css`
- `dist/vendor/web-keyframes/dist/*`

The generated CSS contains only `@keyframes`. The example's `animation` shorthand stays in
`src/styles/example.scss`.

`dist/` is deleted and rebuilt on each run so old files do not linger.
