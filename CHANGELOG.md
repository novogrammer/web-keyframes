# Changelog

All notable changes to `web-keyframes` will be documented in this file.

## [Unreleased]

### Changed

- Breaking: removed timeline `id` and made `animationName` the only timeline name; generated `@keyframes` and editor preview now use `animationName`
- Updated the editor UI, tests, and example timeline JSON files to require explicit `animationName`

## [0.3.0] - 2026-06-25

### Changed

- Allowed timelines to keep `keyframes: []` while authoring, including empty new timelines in the editor and empty `@keyframes` output until frames are added
- Split timeline positioning into explicit `time` and `percent` modes via `positionType`, so `duration` is only used on time-based timelines
- Updated the timeline JSON shape and bundled examples to support explicit position mode metadata and percent-based keyframes

## [0.2.1] - 2026-06-22

### Fixed

- Added explicit root and `./editor` type exports so `web-keyframes/editor` resolves its declarations in consumers using package subpath exports
- Added `typesVersions` fallback entries so TypeScript projects still using `moduleResolution: "node"` can resolve `web-keyframes/editor` without consumer-side workarounds

## [0.2.0] - 2026-06-22

### Added

- Editing helpers for timeline data, including `nudge`, `offset`, `duplicate`, `spread`, `mirror`, and `stagger`
- Browser preview CSS generation and editor preview / reset workflow against matching `animation-name` targets
- Published `basic` and `hero-animation` example projects, plus GitHub Pages hosting support
- Japanese documentation, release guide, and project maintenance notes under `docs/`

### Changed

- Reworked keyframe properties into a sparse `properties[]` model so `opacity` and `transform` can be added, removed, and round-tripped without densifying JSON
- Replaced fixed transform fields with an ordered transform list supporting `translate`, `scale`, `rotate`, and `skew`, and kept that order consistent across the data model, CSS output, preview generation, and editor UI
- Renamed translate output settings to `translateConfig` and simplified the data model by removing legacy preview-only fields such as `target` and `designWidth`
- Switched the package surface from SCSS generation to CSS generation, including CLI output and editor copy / preview flows
- Expanded the editor UI to support multiple timelines, draggable positioning, transform reordering, nullable property controls, timing function presets, and more robust slider / focus handling
- Updated the bundled examples to consume timeline JSON files and use the current package build flow

## [0.1.0] - 2026-06-13

### Added

- Core timeline data types, validation, normalization, and SCSS generation
- `web-keyframes to-scss` CLI for single-file and directory conversion
- Browser-side `WebKeyframesEditor` with:
  - mount / unmount / show / hide / toggle lifecycle
  - editable timeline metadata and keyframe properties
  - add / duplicate / delete keyframe actions
  - JSON / SCSS preview and clipboard copy
  - reset-to-default action
  - optional visibility shortcut and `Escape` preview close
- Automated tests for core, CLI, and editor behavior
- README usage docs and release notes scaffolding
- `prepare` / `prepack` build flow so GitHub installs and packed artifacts can generate `dist/` without tracking it in git
