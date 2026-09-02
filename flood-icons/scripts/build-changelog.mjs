#!/usr/bin/env node
/**
 * build-changelog.mjs
 * --------------------
 * Derives a changelog straight from git history — no hand-maintained file to
 * forget to update. Walks every commit that touched icons/mono/** or
 * icons/colour/** (SVG files only), groups the per-file add/modify/delete/
 * rename status by commit, and writes public/api/changelog.json for the UI's
 * "Changelog" panel.
 *
 * Run automatically as part of `npm run manifest` (see package.json).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, basename, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_FILE = join(ROOT, 'public', 'api', 'changelog.json');
const SEP = '\u0001'; // unlikely-to-collide field separator for git log format

const titleCase = (s) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** icons/{style}/{...cat}/{id}.svg -> { style, id, category } (or null if not an icon path) */
function parseIconPath(path) {
  const m = path.match(/icons\/(mono|colour)\/(.+)\.svg$/);
  if (!m) return null;
  const [, style, relNoExt] = m;
  const parts = relNoExt.split('/');
  const id = basename(parts[parts.length - 1]);
  const category = parts.length > 1 ? titleCase(parts[0]) : null;
  return { style, id, category };
}

let raw = '';
try {
  // %x01 separates commit fields; --name-status appends one "STATUS\tpath"
  // line per changed file directly after the commit line.
  raw = execSync(
    `git log --name-status --no-renames --format=COMMIT${SEP}%H${SEP}%aI${SEP}%s -- icons/mono icons/colour`,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }
  ).toString();
} catch {
  console.warn('  ⚠ changelog: not a git repo (or no history yet) — writing empty changelog');
}

const entries = [];
let current = null;

for (const line of raw.split('\n')) {
  if (line.startsWith('COMMIT' + SEP)) {
    if (current && current.changes.length) entries.push(current);
    const [, hash, date, subject] = line.split(SEP);
    current = { commit: hash.slice(0, 7), date, message: subject, changes: [] };
    continue;
  }
  if (!line.trim() || !current) continue;
  const [status, path] = line.split('\t');
  const info = parseIconPath(path);
  if (!info) continue; // ignore non-icon files (tags.json, tokens.json, etc.)
  const type = status.startsWith('A') ? 'added'
    : status.startsWith('D') ? 'removed'
    : status.startsWith('M') ? 'modified'
    : null;
  if (!type) continue;
  current.changes.push({ type, style: info.style, id: info.id, name: titleCase(info.id), category: info.category });
}
if (current && current.changes.length) entries.push(current);

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify({ generated: new Date().toISOString(), entries }, null, 2)
);
console.log(`✓ ${entries.length} commit${entries.length === 1 ? '' : 's'} → public/api/changelog.json`);
