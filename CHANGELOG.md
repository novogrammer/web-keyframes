# Changelog

All notable changes to `web-keyframes` will be documented in this file.

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
