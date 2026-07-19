import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchIcons } from './lib/search.js';
import { exportIcons, copySvg, resolveSvg } from './lib/exportIcons.js';
import { svgToJsx, svgToComponent } from './lib/jsx.js';

const SIZES = [12, 16, 20, 24];
const NEW_WINDOW_DAYS = 30;
const isNew = (icon) =>
  (Date.now() - new Date(icon.added).getTime()) / 86400000 <= NEW_WINDOW_DAYS;

/* Inline an icon's SVG with live overrides (theme vars resolve via CSS). */
function Glyph({ icon, size }) {
  const html = useMemo(
    () => icon.svg.replace(/<svg /, `<svg width="${size}" height="${size}" `),
    [icon, size]
  );
  return <span className="glyph" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* Fixed-theme glyph for the light/dark comparison cells. */
function ThemedGlyph({ icon, tokens, mode, size }) {
  const html = useMemo(
    () => resolveSvg(icon, { theme: mode, tokens, size }),
    [icon, tokens, mode, size]
  );
  return <span className="glyph" dangerouslySetInnerHTML={{ __html: html }} />;
}

const BrandMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="var(--accent)" />
    <path d="M5 10c1.8-1.5 3.2-1.5 5 0s3.2 1.5 5 0 3-1.4 4-.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    <path d="M5 15c1.8-1.5 3.2-1.5 5 0s3.2 1.5 5 0 3-1.4 4-.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" opacity="0.65" />
  </svg>
);

const WaveRule = () => (
  <svg className="wave-rule" viewBox="0 0 1200 10" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 5 Q 15 0 30 5 T 60 5 T 90 5 T 120 5 T 150 5 T 180 5 T 210 5 T 240 5 T 270 5 T 300 5 T 330 5 T 360 5 T 390 5 T 420 5 T 450 5 T 480 5 T 510 5 T 540 5 T 570 5 T 600 5 T 630 5 T 660 5 T 690 5 T 720 5 T 750 5 T 780 5 T 810 5 T 840 5 T 870 5 T 900 5 T 930 5 T 960 5 T 990 5 T 1020 5 T 1050 5 T 1080 5 T 1110 5 T 1140 5 T 1170 5 T 1200 5" stroke="var(--accent)" />
  </svg>
);

export default function App() {
  const [data, setData] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [theme, setTheme] = useState(() => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [query, setQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('all'); // all | mono | colour
  const [category, setCategory] = useState('All');
  const [previewSize, setPreviewSize] = useState(24);
  const [selected, setSelected] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState('');
  const [exportOpts, setExportOpts] = useState({ svg: true, png: false, sizes: { 12: false, 16: true, 20: false }, themes: { light: true, dark: false }, scale: 1 });
  const [busy, setBusy] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const hoveredRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}api/icons.json`).then((r) => r.json()).then(setData);
    fetch(`${base}api/tokens.json`).then((r) => r.json()).then(setTokens);
  }, []);

  // Theme: flip data attribute + push icon token values into CSS custom properties
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!tokens) return;
    for (const [name, val] of Object.entries(tokens)) {
      document.documentElement.style.setProperty(name, val[theme]);
    }
  }, [theme, tokens]);

  // "/" focuses search, Escape clears panel/selection
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setActiveId(null);
        setSelected(new Set());
      }
      // Hover an icon + press C to copy its themed SVG instantly
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey
          && document.activeElement?.tagName !== 'INPUT' && hoveredRef.current && tokens) {
        const icon = hoveredRef.current;
        copySvg(icon, { theme, tokens })
          .then(() => flash(`${icon.name} SVG copied`));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tokens, theme]);

  const icons = data?.icons ?? [];

  const categories = useMemo(() => {
    const counts = new Map();
    for (const i of icons) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    return [['All', icons.length], ...[...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))];
  }, [icons]);

  const visible = useMemo(() => {
    let list = icons;
    if (showNewOnly) list = list.filter(isNew);
    if (styleFilter !== 'all') list = list.filter((i) => i.style === styleFilter);
    if (category !== 'All') list = list.filter((i) => i.category === category);
    return searchIcons(list, query);
  }, [icons, styleFilter, category, query, showNewOnly]);

  const newCount = useMemo(() => icons.filter(isNew).length, [icons]);
  const active = icons.find((i) => i.id === activeId) ?? null;
  const selectedIcons = icons.filter((i) => selected.has(i.id));

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const buildOpts = () => ({
    formats: [exportOpts.svg && 'svg', exportOpts.png && 'png'].filter(Boolean),
    sizes: Object.entries(exportOpts.sizes).filter(([, v]) => v).map(([k]) => +k),
    themes: Object.entries(exportOpts.themes).filter(([, v]) => v).map(([k]) => k),
    tokens,
    scale: exportOpts.scale,
  });

  const runExport = async (iconsToExport, opts) => {
    if (!opts.formats.length || !opts.themes.length || (opts.formats.includes('png') && !opts.sizes.length)) {
      flash('Pick at least one format, theme — and a size for PNG');
      return;
    }
    setBusy(true);
    try {
      await exportIcons(iconsToExport, opts);
      flash(`Exported ${iconsToExport.length} icon${iconsToExport.length > 1 ? 's' : ''}`);
    } catch (e) {
      flash('Export failed — check the console');
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (!data || !tokens) {
    return <div className="empty">Loading icon set…</div>;
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          Flood Icons <span className="sub">by Flood Intelligence</span>
        </div>
        <div className="searchbox">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, tag or type — try “gate”, “rainfall”, “crossing”…"
            aria-label="Search icons"
          />
          <kbd>/</kbd>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle colour theme"
          >
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 13A8.5 8.5 0 1 1 11 3a7 7 0 0 0 10 10z" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></svg>
            )}
          </button>
          <a className="icon-btn" href="https://github.com/" title="View on GitHub" aria-label="GitHub repository">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8a10.2 10.2 0 0 0-3.2 19.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.3-.3-4.7-1.1-4.7-5a4 4 0 0 1 1-2.8 3.7 3.7 0 0 1 .1-2.7s.9-.3 2.8 1a9.7 9.7 0 0 1 5.2 0c2-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a4 4 0 0 1 1 2.8c0 3.9-2.4 4.8-4.7 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8z" /></svg>
          </a>
        </div>
      </header>

      <div className="spec-strip">
        <span className="spec"><b>24 × 24</b> grid</span>
        <span className="spec"><b>2</b> styles · mono-line + full colour</span>
        <span className="spec"><b>{icons.length}</b> icons + counting</span>
        <span className="spec">light / dark from <b>design tokens</b></span>
        <span className="free">open source — free to use</span>
        <a className="spec request-link" href="https://github.com/" title="Open an icon request on GitHub">request an icon →</a>
      </div>
      <WaveRule />

      <div className="controls">
        <div className="control-group">
          <span className="control-label">Style</span>
          <div className="seg" role="group" aria-label="Icon style">
            {['all', 'mono', 'colour'].map((s) => (
              <button key={s} aria-pressed={styleFilter === s} onClick={() => setStyleFilter(s)}>
                {s === 'all' ? 'All' : s === 'mono' ? 'Mono-line' : 'Colour'}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">Preview</span>
          <div className="seg" role="group" aria-label="Preview size">
            {SIZES.map((s) => (
              <button key={s} aria-pressed={previewSize === s} onClick={() => setPreviewSize(s)}>{s}px</button>
            ))}
          </div>
        </div>
      </div>

      <div className="chips">
        {newCount > 0 && (
          <button className="chip new-chip" aria-pressed={showNewOnly} onClick={() => setShowNewOnly((v) => !v)}>
            New<span className="count">{newCount}</span>
          </button>
        )}
        {categories.map(([name, count]) => (
          <button key={name} className="chip" aria-pressed={category === name} onClick={() => setCategory(name)}>
            {name}<span className="count">{count}</span>
          </button>
        ))}
      </div>

      <div className="workspace">
        <main className="grid-wrap">
          {visible.length === 0 ? (
            <div className="empty">
              <b>No icons match “{query}”.</b>
              <br />Try a broader term — tags and similar names are searched too.
            </div>
          ) : (
            <div className="grid">
              {visible.map((icon) => (
                <div
                  key={icon.style + icon.id}
                  className="tile"
                  data-active={activeId === icon.id}
                  data-selected={selected.has(icon.id)}
                  onClick={(e) => (e.metaKey || e.ctrlKey ? toggleSelect(icon.id) : setActiveId(icon.id))}
                  onMouseEnter={() => (hoveredRef.current = icon)}
                  onMouseLeave={() => { if (hoveredRef.current?.id === icon.id) hoveredRef.current = null; }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveId(icon.id)}
                  title={`${icon.name} — click for detail, ⌘/Ctrl-click to select, C to copy SVG`}
                >
                  <button
                    className="select-box"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(icon.id); }}
                    aria-label={`Select ${icon.name}`}
                  >
                    {selected.has(icon.id) && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><path d="m4.5 12.5 5 5 10-11" /></svg>
                    )}
                  </button>
                  <span className="style-dot" data-style={icon.style} title={icon.style} />
                  {isNew(icon) && <span className="new-badge">new</span>}
                  <Glyph icon={icon} size={previewSize} />
                  <span className="label">{icon.name}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        {active && (
          <aside className="detail" aria-label={`${active.name} detail`}>
            <button className="close" onClick={() => setActiveId(null)} aria-label="Close panel">✕</button>
            <h2>{active.name}</h2>
            <div className="meta">{active.style} · {active.category} · {active.id}.svg</div>

            <div className="preview-pair">
              <div className="preview-cell" data-mode="light">
                <ThemedGlyph icon={active} tokens={tokens} mode="light" size={40} />
                <span className="tag">light</span>
              </div>
              <div className="preview-cell" data-mode="dark">
                <ThemedGlyph icon={active} tokens={tokens} mode="dark" size={40} />
                <span className="tag">dark</span>
              </div>
            </div>

            <div className="section-label">At size</div>
            <div className="preview-cell" data-checker="true" style={{ height: 'auto', padding: '12px 0 8px' }}>
              <div className="size-row">
                {SIZES.map((s) => (
                  <div className="size-cell" key={s}>
                    <Glyph icon={active} size={s} />
                    <span className="px">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {active.note && <p className="note">{active.note}</p>}
            {(active.tags.length > 0 || active.synonyms.length > 0) && (
              <>
                <div className="section-label">Tags</div>
                <div className="tags">
                  {[...active.tags, ...active.synonyms].map((t) => <span key={t}>{t}</span>)}
                </div>
              </>
            )}

            <div className="section-label">Export · {theme} theme</div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => runExport([active], { formats: ['svg'], sizes: [], themes: [theme], tokens, scale: 1 })}>SVG</button>
              {[12, 16, 20].map((s) => (
                <button key={s} className="btn" onClick={() => runExport([active], { formats: ['png'], sizes: [s], themes: [theme], tokens, scale: 1 })}>PNG {s}px</button>
              ))}
              <button className="btn" onClick={() => runExport([active], { formats: ['png'], sizes: [12, 16, 20], themes: [theme], tokens, scale: 2 })}>PNG all @2x</button>
              <button
                className="btn"
                onClick={async () => {
                  await copySvg(active, { theme, tokens });
                  flash('SVG copied to clipboard');
                }}
              >
                Copy SVG
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(svgToJsx(resolveSvg(active, { theme, tokens })));
                  flash('JSX copied to clipboard');
                }}
              >
                Copy JSX
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(svgToComponent(active));
                  flash('React component copied');
                }}
              >
                Copy component
              </button>
            </div>
          </aside>
        )}
      </div>

      {selectedIcons.length > 0 && (
        <div className="export-bar" role="region" aria-label="Export selection">
          <span className="count-label"><b>{selectedIcons.length}</b> selected</span>
          <div className="opt-group">
            <label><input type="checkbox" checked={exportOpts.svg} onChange={(e) => setExportOpts((o) => ({ ...o, svg: e.target.checked }))} />SVG</label>
            <label><input type="checkbox" checked={exportOpts.png} onChange={(e) => setExportOpts((o) => ({ ...o, png: e.target.checked }))} />PNG</label>
          </div>
          {exportOpts.png && (
            <>
              <div className="opt-group">
                {[12, 16, 20].map((s) => (
                  <label key={s}>
                    <input type="checkbox" checked={exportOpts.sizes[s]} onChange={(e) => setExportOpts((o) => ({ ...o, sizes: { ...o.sizes, [s]: e.target.checked } }))} />
                    {s}px
                  </label>
                ))}
              </div>
              <div className="opt-group">
                <label>
                  <input type="checkbox" checked={exportOpts.scale === 2} onChange={(e) => setExportOpts((o) => ({ ...o, scale: e.target.checked ? 2 : 1 }))} />
                  @2x
                </label>
              </div>
            </>
          )}
          <div className="opt-group">
            {['light', 'dark'].map((t) => (
              <label key={t}>
                <input type="checkbox" checked={exportOpts.themes[t]} onChange={(e) => setExportOpts((o) => ({ ...o, themes: { ...o.themes, [t]: e.target.checked } }))} />
                {t}
              </label>
            ))}
          </div>
          <button className="btn primary" disabled={busy} onClick={() => runExport(selectedIcons, buildOpts())}>
            {busy ? 'Exporting…' : 'Export zip'}
          </button>
          <button className="clear" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
