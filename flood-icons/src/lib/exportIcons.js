import JSZip from 'jszip';

/**
 * Resolve an icon's SVG source into a standalone file:
 * - var(--token, fallback) → literal hex for the chosen theme
 * - currentColor → ink token for the chosen theme
 * - stroke-width overridden (mono icons only)
 * - width/height attributes set for the chosen size
 */
export function resolveSvg(icon, { theme, tokens, stroke, size }) {
  let svg = icon.svg;

  svg = svg.replace(/var\((--fi-[\w-]+)(?:,\s*[^)]+)?\)/g, (m, name) => {
    const t = tokens[name];
    return t ? t[theme] : m;
  });

  const ink = tokens['--fi-ink'] ? tokens['--fi-ink'][theme] : '#333333';
  svg = svg.replace(/currentColor/g, ink);

  if (icon.strokeAdjustable && stroke != null) {
    svg = svg.replace(/stroke-width="[\d.]+"/g, `stroke-width="${stroke}"`);
  }

  if (size != null) {
    svg = svg.replace(
      /<svg /,
      `<svg width="${size}" height="${size}" `
    );
  }

  return svg;
}

/** Render a resolved SVG string to a PNG blob at the given pixel size. */
export function svgToPngBlob(svgString, px) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG render failed'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG could not be rasterised'));
    };
    img.src = url;
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Export one or more icons.
 * opts: { formats: ['svg','png'], sizes: [12,16,20], themes: ['light'|'dark'], tokens, stroke, scale }
 * Single SVG at one theme → direct .svg download. Anything else → .zip.
 */
export async function exportIcons(icons, opts) {
  const { formats, sizes, themes, tokens, stroke, scale = 1 } = opts;

  const jobs = [];
  for (const icon of icons) {
    for (const theme of themes) {
      const themeSuffix = themes.length > 1 ? `-${theme}` : '';
      if (formats.includes('svg')) {
        const svg = resolveSvg(icon, { theme, tokens, stroke });
        jobs.push({ path: `svg/${icon.id}${themeSuffix}.svg`, blob: new Blob([svg], { type: 'image/svg+xml' }) });
      }
      if (formats.includes('png')) {
        for (const size of sizes) {
          const px = size * scale;
          const svg = resolveSvg(icon, { theme, tokens, stroke, size: px });
          const blob = await svgToPngBlob(svg, px);
          const scaleSuffix = scale > 1 ? `@${scale}x` : '';
          jobs.push({ path: `png/${size}px/${icon.id}${themeSuffix}-${size}px${scaleSuffix}.png`, blob });
        }
      }
    }
  }

  if (jobs.length === 1) {
    triggerDownload(jobs[0].blob, jobs[0].path.split('/').pop());
    return;
  }

  const zip = new JSZip();
  for (const j of jobs) zip.file(j.path, j.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `flood-icons-${icons.length === 1 ? icons[0].id : icons.length + '-icons'}-${stamp}.zip`);
}

export async function copySvg(icon, opts) {
  const svg = resolveSvg(icon, opts);
  await navigator.clipboard.writeText(svg);
}
