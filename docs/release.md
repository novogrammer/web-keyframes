# Release Guide

This project is currently intended to be installed from GitHub tags rather than published to npm.

## Versioning

- Track unreleased changes under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md) while work is still on the branch
- Update `package.json` `version`
- Promote the `Unreleased` entries into a new versioned section in [CHANGELOG.md](../CHANGELOG.md) when cutting a release
- Keep the install example in [README.md](../README.md) aligned with the next tag when needed

## Pre-release checks

Run these commands from the repo root:

```bash
npm install
npm run build
npm run typecheck
node --test
```

Expected result:

- `dist/` is rebuilt successfully
- typecheck passes
- all tests pass

## Release steps

1. Review the working tree and commit any intended changes.
2. Bump the version in `package.json`.
3. Update `CHANGELOG.md` with the release date and notable changes.
4. Re-run the verification commands.
5. Create a git commit for the release metadata if needed.
6. Create an annotated tag, for example:

```bash
git tag -a v0.2.0 -m "web-keyframes v0.2.0"
```

7. Push the branch and tag:

```bash
git push origin main
git push origin v0.2.0
```

## Install from GitHub

Consumers can install a tagged release like this:

```bash
npm install github:YOUR_NAME/web-keyframes#v0.2.0
```

## Notes

- `dist/` is ignored in git.
- GitHub installs rely on the package `prepare` step to build `dist/` from source during installation.
- `prepack` also rebuilds `dist/` before creating a tarball, so local package archives and future npm publishing use the same output path.
