#!/usr/bin/env node
/**
 * build-npm.mjs — generates a publish-ready npm package in npm-pkg/.
 *
 *   npm run manifest && node scripts/build-npm.mjs
 *   cd npm-pkg && npm publish --access public
 *
 * Consumers get three entry points:
 *   import { icons, tokens } from 'flood-icons-fi'          // raw data
 *   import { FloodIcon } from 'flood-icons-fi/react'        // <FloodIcon name="weir" />
 *   import { WeirIcon } from 'flood-icons-fi/react-icons'   // tree-shakeable per-icon
 *
 * Per-icon components are emitted as plain React.createElement calls,
 * so no JSX transform is required to consume the package.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'npm-pkg');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'api', 'icons.json'), 'utf8'));
const tokens = JSON.parse(readFileSync(join(ROOT, 'public', 'api', 'tokens.json'), 'utf8'));

mkdirSync(OUT, { recursive: true });

const byId = {};
const collisions = [];
for (const i of manifest.icons) {
  if (byId[i.id]) collisions.push(i.id);
  byId[i.id] = { id: i.id, name: i.name, style: i.style, category: i.category, tags: i.tags, svg: i.svg, strokeAdjustable: i.strokeAdjustable };
}
if (collisions.length) {
  console.error(`✗ duplicate ids across styles: ${collisions.join(', ')} — rename before publishing`);
  process.exit(1);
}

// ---- index.js: data ----
writeFileSync(join(OUT, 'index.js'),
`export const icons = ${JSON.stringify(byId)};
export const tokens = ${JSON.stringify(tokens)};
export const version = ${JSON.stringify(pkg.version)};
`);

// ---- react.js: generic component ----
writeFileSync(join(OUT, 'react.js'),
`import * as React from 'react';
import { icons } from './index.js';

/**
 * <FloodIcon name="weir" size={16} strokeWidth={1.75} title="Weir" />
 * Mono icons inherit colour from CSS currentColor. Colour icons carry
 * token fills with hex fallbacks; override via --fi-* custom properties.
 */
export function FloodIcon({ name, size = 24, strokeWidth, title, style, ...rest }) {
  const icon = icons[name];
  if (!icon) {
    if (process.env.NODE_ENV !== 'production') console.warn('[flood-icons] unknown icon: ' + name);
    return null;
  }
  let svg = icon.svg.replace(/<svg /, '<svg width="' + size + '" height="' + size + '" ');
  if (strokeWidth != null && icon.strokeAdjustable) {
    svg = svg.replace(/stroke-width="[\\d.]+"/g, 'stroke-width="' + strokeWidth + '"');
  }
  return React.createElement('span', {
    role: 'img',
    'aria-label': title ?? icon.name,
    style: { display: 'inline-flex', lineHeight: 0, ...style },
    dangerouslySetInnerHTML: { __html: svg },
    ...rest,
  });
}
`);

// ---- react-icons.js: tree-shakeable per-icon components ----
const pascal = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const perIcon = manifest.icons.map((i) =>
`export const ${pascal(i.id)}Icon = (props) => React.createElement(FloodIcon, { name: ${JSON.stringify(i.id)}, ...props });`
).join('\n');
writeFileSync(join(OUT, 'react-icons.js'),
`import * as React from 'react';
import { FloodIcon } from './react.js';
${perIcon}
`);

// ---- package.json ----
writeFileSync(join(OUT, 'package.json'), JSON.stringify({
  name: 'flood-icons-fi', // ← rename to your scope, e.g. @flood-intelligence/icons
  version: pkg.version,
  description: pkg.description,
  type: 'module',
  main: './index.js',
  exports: {
    '.': './index.js',
    './react': './react.js',
    './react-icons': './react-icons.js',
  },
  sideEffects: false,
  peerDependencies: { react: '>=17' },
  peerDependenciesMeta: { react: { optional: true } },
  license: 'SEE LICENSE IN LICENSE',
  keywords: ['icons', 'svg', 'flood', 'hydraulics', 'design-tokens'],
}, null, 2));

writeFileSync(join(OUT, 'README.md'),
`# flood-icons-fi\n\nIcon data + React components for the Flood Intelligence icon set.\nGenerated from the flood-icons repo — do not edit by hand.\n`);

console.log(`✓ npm package → npm-pkg/ (${manifest.icons.length} icons)`);
