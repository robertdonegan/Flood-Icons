#!/usr/bin/env node
/**
 * build-manifest.mjs
 * ------------------
 * The whole "add a new icon" workflow is:
 *
 *   1. Drop an SVG into icons/mono/ or icons/colour/
 *   2. (Optionally) add tags for it in icons/tags.json
 *   3. Run `npm run manifest` (also runs automatically on dev/build)
 *
 * This script then:
 *   - Validates each SVG (24×24 viewBox expected, warns otherwise)
 *   - Injects hex fallbacks into var(--token) references so raw files
 *     work anywhere, even outside the site: var(--fi-water, #0a7dff)
 *   - Copies processed SVGs to public/icons/{style}/
 *   - Writes public/api/icons.json   (full manifest + inline SVG source)
 *   - Writes public/api/tokens.json  (light/dark token values)
 *   - Writes public/api/version.json (count, build time, git hash if available)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, basename, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ICON_DIR = join(ROOT, 'icons');
const OUT_DIR = join(ROOT, 'public');
const STYLES = ['mono', 'colour'];

/** First-commit date for a file (drives the "new" badge); mtime until it's in git. */
function addedDate(absPath) {
  try {
    const out = execSync(
      `git log --follow --diff-filter=A --format=%aI -1 -- "${absPath}"`,
      { cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] }
    ).toString().trim();
    if (out) return out;
  } catch { /* not a git repo yet */ }
  return statSync(absPath).mtime.toISOString();
}

const tokensFile = JSON.parse(readFileSync(join(ICON_DIR, 'tokens.json'), 'utf8'));
const tokens = tokensFile.tokens;
const tagsFile = existsSync(join(ICON_DIR, 'tags.json'))
  ? JSON.parse(readFileSync(join(ICON_DIR, 'tags.json'), 'utf8'))
  : {};

const titleCase = (s) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Recursively collect .svg files under a style dir (e.g. icons/mono).
 * The first-level subfolder name becomes the category, so
 * icons/mono/arrows/arrow-up.svg → category "Arrows". Files sitting
 * directly in the style dir have no folder category (null).
 * Returns { abs, rel, category } — rel is POSIX, relative to the style dir.
 */
function collectSvgs(styleDir) {
  const out = [];
  const walk = (dir, relBase, category) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), rel, category ?? titleCase(entry.name));
      } else if (entry.name.endsWith('.svg')) {
        out.push({ abs: join(dir, entry.name), rel, category });
      }
    }
  };
  walk(styleDir, '', null);
  return out;
}

/** Inject light-mode hex fallbacks into var() references that lack one. */
function withFallbacks(svg) {
  return svg.replace(/var\((--fi-[\w-]+)\)/g, (m, name) => {
    const t = tokens[name];
    if (!t) {
      console.warn(`  ⚠ unknown token ${name} — no fallback injected`);
      return m;
    }
    return `var(${name}, ${t.light})`;
  });
}

function extractTokens(svg) {
  return [...new Set([...svg.matchAll(/var\((--fi-[\w-]+)/g)].map((m) => m[1]))];
}

const manifest = [];
let warnings = 0;
const seenIds = new Map(); // id -> "style/rel" of first occurrence, for collision warnings

for (const style of STYLES) {
  const dir = join(ICON_DIR, style);
  if (!existsSync(dir)) continue;

  for (const { abs, rel, category: folderCat } of collectSvgs(dir)) {
    const id = basename(rel, '.svg');

    const idKey = `${style}/${id}`;
    if (seenIds.has(idKey)) {
      console.warn(`  ⚠ ${style}/${rel}: duplicate id "${id}" (also ${seenIds.get(idKey)}) — sprite/id collision`);
      warnings++;
    } else {
      seenIds.set(idKey, `${style}/${rel}`);
    }

    let svg = readFileSync(abs, 'utf8').trim();

    const vb = svg.match(/viewBox="([^"]+)"/)?.[1];
    if (vb !== '0 0 24 24') {
      console.warn(`  ⚠ ${style}/${rel}: viewBox is "${vb}" (expected "0 0 24 24")`);
      warnings++;
    }

    svg = withFallbacks(svg);
    // Collapse whitespace between tags for a compact payload
    const compact = svg.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ');
    const outFile = join(OUT_DIR, 'icons', style, rel);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, compact);

    const meta = tagsFile[id] ?? {};
    manifest.push({
      id,
      name: meta.name ?? titleCase(id),
      style, // 'mono' | 'colour'
      category: meta.category ?? folderCat ?? 'Uncategorised',
      tags: meta.tags ?? [],
      synonyms: meta.synonyms ?? [],
      note: meta.note ?? null,
      strokeAdjustable: style === 'mono',
      tokens: extractTokens(compact),
      added: addedDate(abs),
      path: `/icons/${style}/${rel}`,
      svg: compact,
    });
  }
}

let git = null;
try {
  git = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] })
    .toString().trim();
} catch { /* not a git repo yet */ }

mkdirSync(join(OUT_DIR, 'api'), { recursive: true });

// Sprite sheet: <use href="/api/sprite.svg#fi-weir"> in any page.
// Token fills keep their hex fallbacks; currentColor and --fi-* custom
// properties inherit into <use> instances, so theming still works.
const symbols = manifest.map((i) => {
  const inner = i.svg
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const rootAttrs = i.svg.match(/<svg([^>]*)>/)[1]
    .replace(/\s*xmlns="[^"]*"/, '')
    .replace(/\s*viewBox="[^"]*"/, '');
  return `<symbol id="fi-${i.id}" viewBox="0 0 24 24"${rootAttrs}>${inner}</symbol>`;
}).join('');
writeFileSync(
  join(OUT_DIR, 'api', 'sprite.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols}</svg>`
);

writeFileSync(
  join(OUT_DIR, 'api', 'icons.json'),
  JSON.stringify({ generated: new Date().toISOString(), count: manifest.length, icons: manifest }, null, 2)
);
writeFileSync(
  join(OUT_DIR, 'api', 'tokens.json'),
  JSON.stringify(tokens, null, 2)
);
writeFileSync(
  join(OUT_DIR, 'api', 'version.json'),
  JSON.stringify({ count: manifest.length, generated: new Date().toISOString(), commit: git }, null, 2)
);

console.log(`✓ ${manifest.length} icons → public/api/icons.json${warnings ? ` (${warnings} warning${warnings > 1 ? 's' : ''})` : ''}`);
