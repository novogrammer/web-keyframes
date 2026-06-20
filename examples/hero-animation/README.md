# hero-animation example

This example ports the Theatre.js study under
`hello-theatrejs/src/study/hero-animation/` into `web-keyframes`.

## Install

```bash
cd examples/hero-animation
npm install
```

## Run the example page

```bash
npm run dev
```

Then open the served URL and use:

- `Ctrl+Shift+K` to toggle the editor
- `Toggle editor` button to open and close the overlay
- `Preview` to rerun the selected generated timeline against the matching hero element

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

`dist/` is deleted and rebuilt on each run so old files do not linger.
