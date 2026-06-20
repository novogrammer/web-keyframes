# Changelog

All notable changes to `web-keyframes` will be documented in this file.

## [0.1.0] - 2026-06-13

### Added

- Core timeline data types, validation, normalization, and CSS generation
- `web-keyframes to-css` CLI for single-file and directory conversion
- Browser-side `WebKeyframesEditor` with:
  - mount / unmount / show / hide / toggle lifecycle
  - editable timeline metadata and keyframe properties
  - add / duplicate / delete keyframe actions
  - JSON / CSS preview and clipboard copy
  - reset-to-default action
  - optional visibility shortcut and `Escape` preview close
- Automated tests for core, CLI, and editor behavior
- README usage docs and release notes scaffolding
- `prepare` / `prepack` build flow so GitHub installs and packed artifacts can generate `dist/` without tracking it in git

### Changed

- Unified `scale` to always use `x` and `y` in the data model and always emit CSS as `scale(x, y)`
- Added keyframe-local `timingFunction` passthrough for `animation-timing-function`
- Preserved sparse keyframe JSON shape through editor load, `getData()`, and `toJson()` round-trips
- Added hosted `basic` and `hero-animation` examples, and aligned `basic` to load timeline JSON instead of embedding editor data in JavaScript
