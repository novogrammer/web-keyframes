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
- The `WKF` card is animated by generated CSS compiled from timeline JSON

## Build generated styles

```bash
npm run build:styles
```

This writes:

- `src/generated/_animations.generated.scss`
- `src/generated/example.css`

`npm run dev` runs this build step automatically before serving the page.
