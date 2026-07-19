# Contributing

## Requesting an icon
Open an [icon request](../../issues/new?template=icon-request.yml) — name, style, and where you'd use it.

## Submitting an icon
1. Draw on the 24×24 grid. Mono: 1.5px stroke, `stroke="currentColor"`, `fill="none"`, live strokes (not outlined). Colour: token fills only — `fill="var(--fi-water)"` — see `icons/tokens.json`.
2. Drop the SVG in `icons/mono/` or `icons/colour/` and add tags in `icons/tags.json`.
3. Run `node scripts/lint-icons.mjs` locally — CI runs the same check on your PR and blocks raw hex, wrong grids, and non-standard strokes.
4. Open a PR. The preview/deploy pipeline rebuilds the manifest automatically.
