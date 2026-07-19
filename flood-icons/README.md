# Flood Icons

Open-source iconography for Flood Intelligence products. Two styles — **mono-line** (1.5px stroke, `currentColor`) and **full colour** (design-token fills) — on a 24×24 grid, with light and dark variants driven by the same colour tokens as the product suite.

Built with Vite + React. Deploys as a fully static site, which means the icon API is just files — no server, nothing to maintain.

## Run it

```bash
npm install
npm run dev
```

## Adding a new icon

1. Export from Figma at 24×24 and drop the SVG into `icons/mono/` or `icons/colour/`.
   - **Mono:** use `stroke="currentColor"`, `stroke-width="1.5"`, `fill="none"`. The site's stroke slider and theme switch then work automatically.
   - **Colour:** reference tokens instead of hex, e.g. `fill="var(--fi-water)"`. Available tokens live in `icons/tokens.json` — add new ones there with a light and dark value.
2. (Optional) Add tags, a category and synonyms in `icons/tags.json`. Without an entry, the icon still appears with a name derived from the filename.
3. `npm run manifest` — or just commit; the manifest also builds automatically on `npm run dev` / `npm run build`.

The manifest script injects hex fallbacks into every `var()` reference, so the raw SVG files also work in contexts that don't define the custom properties.

## Deploying

**GitHub Pages** — the included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`. One-time setup: repo **Settings → Pages → Source → GitHub Actions**. The workflow sets `BASE_PATH=/flood-icons/` for a project site; delete that env var if you attach a custom domain (which serves from the root). GitHub Pages sends `Access-Control-Allow-Origin: *` on everything by default, so the API works cross-origin with no configuration.

**Cloudflare Pages** — build command `npm run build`, output directory `dist`. `public/_headers` sets the CORS and cache headers (`_headers` is ignored by GitHub Pages; it's harmless to keep for portability).

## API

Everything is static JSON/SVG, versioned by git and always current with the latest deploy:

| Endpoint | Contents |
|---|---|
| `/api/icons.json` | Full manifest: id, name, style, category, tags, synonyms, tokens used, path, **inline SVG source** |
| `/api/tokens.json` | Every colour token with its light and dark hex |
| `/api/version.json` | Icon count, build timestamp, git commit |
| `/api/sprite.svg` | All icons as `<symbol>`s — `<use href="/api/sprite.svg#fi-weir">` |
| `/icons/{style}/{id}.svg` | Individual raw SVG (CORS-enabled) |

Example — always-latest icons in any app:

```js
const { icons } = await fetch('https://icons.example.com/api/icons.json').then(r => r.json());
const weir = icons.find(i => i.id === 'weir');
container.innerHTML = weir.svg; // inline; responds to your --fi-* custom properties
```

Because the repo is public, GitHub itself doubles as a second distribution channel — `raw.githubusercontent.com` or the jsDelivr CDN (`https://cdn.jsdelivr.net/gh/USER/flood-icons@main/icons/mono/weir.svg`) serve pinned-by-commit versions for free.

## npm package

`npm run build:npm` generates a publish-ready package in `npm-pkg/`:

```js
import { icons, tokens } from 'flood-icons-fi';
import { FloodIcon } from 'flood-icons-fi/react';        // <FloodIcon name="weir" size={16} strokeWidth={1.75} />
import { WeirIcon } from 'flood-icons-fi/react-icons';   // tree-shakeable per-icon components
```

Rename the package in `scripts/build-npm.mjs` (e.g. `@flood-intelligence/icons`), then `cd npm-pkg && npm publish --access public`. Icon ids must be unique across styles — the build fails loudly if they collide.

## In the browser

- `/` focuses search · hover an icon + `C` copies its SVG (current theme + stroke) · `Esc` clears
- Detail panel: Copy SVG / Copy JSX / Copy component, per-size PNG export, light+dark comparison
- Icons added in the last 30 days get a **new** badge and a New filter chip (dates come from git history)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs touching `icons/` run `scripts/lint-icons.mjs` in CI — it blocks wrong grids, raw hex in colour icons, outlined strokes in mono icons, and unknown tokens. Icon requests come in via the GitHub issue template.

## Licence

TBC — MIT or CC BY 4.0 are the usual choices for open icon sets (decide before publishing; not legal advice).
