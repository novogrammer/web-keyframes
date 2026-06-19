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
npm run build:styles
```

This writes:

- `src/generated/animations.css`
- `src/generated/example.css`

The generated CSS contains only `@keyframes`. The example's `animation` shorthand stays in
`src/styles/example.scss`.

`npm run dev` runs this build step automatically before serving the page.
