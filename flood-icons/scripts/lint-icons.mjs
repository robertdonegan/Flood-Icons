#!/usr/bin/env node
/**
 * lint-icons.mjs — strict validation for PRs (run by .github/workflows/icon-lint.yml).
 * Rules:
 *   all    : viewBox must be "0 0 24 24"; every var() must be a known token
 *   mono   : strokes must be currentColor; stroke-width 1.5; no colour fills
 *   colour : no raw hex fills/strokes — use tokens so light/dark stays automatic
 * Exit code 1 on any failure so CI blocks the merge.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ICON_DIR = join(ROOT, 'icons');
const tokens = JSON.parse(readFileSync(join(ICON_DIR, 'tokens.json'), 'utf8')).tokens;

let failures = 0;
const fail = (file, msg) => {
  console.error(`  ✗ ${file}: ${msg}`);
  failures++;
};

for (const style of ['mono', 'colour']) {
  const dir = join(ICON_DIR, style);
  if (!existsSync(dir)) continue;

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    const rel = `${style}/${file}`;
    const svg = readFileSync(join(dir, file), 'utf8');

    if (!/viewBox="0 0 24 24"/.test(svg)) fail(rel, 'viewBox must be "0 0 24 24"');
    if (/(?<![-\w])width="/.test(svg.match(/<svg[^>]*>/)?.[0] ?? '')) {
      fail(rel, 'remove width/height from the root <svg> — sizing is applied downstream');
    }

    for (const m of svg.matchAll(/var\((--[\w-]+)/g)) {
      if (!tokens[m[1]]) fail(rel, `unknown token ${m[1]} — add it to icons/tokens.json`);
    }

    if (style === 'mono') {
      if (!/stroke="currentColor"/.test(svg)) fail(rel, 'mono icons must stroke with currentColor');
      for (const m of svg.matchAll(/stroke-width="([\d.]+)"/g)) {
        if (m[1] !== '1.5') fail(rel, `stroke-width must be 1.5 (found ${m[1]}) — the site handles overrides`);
      }
      for (const m of svg.matchAll(/fill="([^"]+)"/g)) {
        if (m[1] !== 'none' && m[1] !== 'currentColor') {
          fail(rel, `mono icons may only fill with none/currentColor (found ${m[1]})`);
        }
      }
    }

    if (style === 'colour') {
      for (const m of svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)) {
        fail(rel, `raw hex ${m[1]} — reference a token (var(--fi-…)) so light/dark works`);
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} problem${failures > 1 ? 's' : ''} found.`);
  process.exit(1);
}
console.log('✓ all icons pass lint');
