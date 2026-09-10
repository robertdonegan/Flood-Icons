import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchIcons } from './lib/search.js';
import { exportIcons, copySvg, resolveSvg } from './lib/exportIcons.js';
import { svgToJsx, svgToComponent } from './lib/jsx.js';

const SIZES = [12, 16, 20, 24, 32];
const NEW_WINDOW_DAYS = 30;
const isNew = (icon) =>
  (Date.now() - new Date(icon.added).getTime()) / 86400000 <= NEW_WINDOW_DAYS;
// Icon ids are only unique per-style (mono + colour can share the same
// basename, e.g. "map-view"), so selection/active state must key on the
// style+id pair to avoid two different icons being treated as the same one.
const uid = (icon) => `${icon.style}:${icon.id}`;

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
    <g transform="translate(4,4)">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.25001 2C7.25001 1.58579 7.5858 1.25 8.00001 1.25H12C12.4142 1.25 12.75 1.58579 12.75 2V5C12.75 5.41421 12.4142 5.75 12 5.75H8.75001V7.93491C9.53495 8.09394 10.2782 8.5054 10.8472 9.1693L14.5695 13.5119C14.839 13.8264 14.8026 14.2999 14.4881 14.5694C14.1736 14.839 13.7001 14.8026 13.4306 14.4881L11.08 11.7458C11.0537 11.7486 11.027 11.75 11 11.75C10.6571 11.75 10.3363 11.919 10.1424 12.2018L10.1215 12.2323C9.09674 13.7268 6.89825 13.7479 5.845 12.2733L5.74506 12.1334C5.57319 11.8928 5.2957 11.75 5.00001 11.75C4.97299 11.75 4.9463 11.7486 4.92001 11.7458L2.56946 14.4881C2.29989 14.8026 1.82641 14.839 1.51192 14.5694C1.19743 14.2999 1.161 13.8264 1.43057 13.5119L5.1528 9.1693C5.72186 8.5054 6.46508 8.09394 7.25001 7.93491V5V2ZM6.01175 10.4721C6.38773 10.6455 6.71819 10.9151 6.96566 11.2616L7.0656 11.4015C7.51355 12.0286 8.44857 12.0196 8.8844 11.384L8.90532 11.3535C9.17759 10.9564 9.55234 10.6512 9.98087 10.4634L9.70834 10.1455C8.81038 9.09787 7.18965 9.09787 6.29169 10.1455L6.01175 10.4721ZM8.75001 4.25H11.25V2.75H8.75001V4.25Z" fill="#fff" />
    </g>
  </svg>
);

export default function App() {
  const [data, setData] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [changelog, setChangelog] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [theme, setTheme] = useState('light');
  const [query, setQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('all'); // all | mono | colour
  const [category, setCategory] = useState('All');
  const [previewSize, setPreviewSize] = useState(24);
  const [sortBy, setSortBy] = useState('newest'); // newest | name | category
  const [selected, setSelected] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState('');
  const [exportOpts, setExportOpts] = useState({ svg: true, png: false, sizes: { 12: false, 16: true, 20: false, 32: false }, themes: { light: true, dark: false }, scale: 1 });
  const [busy, setBusy] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const hoveredRef = useRef(null);
  const searchRef = useRef(null);
  // Capture the URL's ?icon=/&style= once, before anything (incl. our own sync
  // effect below) has a chance to mutate the address bar.
  const initialLinkRef = useRef(new URLSearchParams(window.location.search));
  const appliedInitialLinkRef = useRef(false);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}api/icons.json`).then((r) => r.json()).then(setData);
    fetch(`${base}api/tokens.json`).then((r) => r.json()).then(setTokens);
    fetch(`${base}api/changelog.json`).then((r) => r.json()).then(setChangelog).catch(() => {});
  }, []);

  // Deep-link: once icons load, open the icon named in ?style=&icon= (if any)
  useEffect(() => {
    if (!data || appliedInitialLinkRef.current) return;
    appliedInitialLinkRef.current = true;
    const wantId = initialLinkRef.current.get('icon');
    if (!wantId) return;
    const wantStyle = initialLinkRef.current.get('style');
    const match = data.icons.find(
      (i) => i.id === wantId && (!wantStyle || i.style === wantStyle)
    );
    if (match) setActiveId(uid(match));
  }, [data]);

  // Keep the URL in sync with the open detail panel so it can be shared/bookmarked
  useEffect(() => {
    // Don't touch the address bar until the initial deep-link (if any) has
    // been read, otherwise we'd wipe ?icon=/&style= before it's consumed.
    if (!appliedInitialLinkRef.current) return;
    const activeIcon = data?.icons.find((i) => uid(i) === activeId) ?? null;
    const url = new URL(window.location.href);
    if (activeIcon) {
      url.searchParams.set('style', activeIcon.style);
      url.searchParams.set('icon', activeIcon.id);
    } else {
      url.searchParams.delete('style');
      url.searchParams.delete('icon');
    }
    window.history.replaceState(null, '', url);
  }, [activeId, data]);

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
        setShowChangelog(false);
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
    list = searchIcons(list, query);
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'category') {
      list = [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) =>
        (new Date(b.added) - new Date(a.added)) ||
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name)
      );
    }
    return list;
  }, [icons, styleFilter, category, query, showNewOnly, sortBy]);

  const newCount = useMemo(() => icons.filter(isNew).length, [icons]);
  const active = icons.find((i) => uid(i) === activeId) ?? null;
  const selectedIcons = icons.filter((i) => selected.has(uid(i)));

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
            onClick={() => setShowChangelog(true)}
            title="View icon changelog"
            aria-label="View icon changelog"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
          </button>
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
          <a className="icon-btn" href="https://github.com/robertdonegan/Flood-Icons" title="View on GitHub" aria-label="GitHub repository">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8a10.2 10.2 0 0 0-3.2 19.9c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.3-.3-4.7-1.1-4.7-5a4 4 0 0 1 1-2.8 3.7 3.7 0 0 1 .1-2.7s.9-.3 2.8 1a9.7 9.7 0 0 1 5.2 0c2-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a4 4 0 0 1 1 2.8c0 3.9-2.4 4.8-4.7 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 12 1.8z" /></svg>
          </a>
        </div>
      </header>

      <div className="spec-strip">
        <span className="spec"><b>16 × 16</b> native grid</span>
        <span className="spec"><b>2</b> styles · mono-line + full colour</span>
        <span className="spec"><b>{icons.length}</b> icons + counting</span>
        <span className="spec">light / dark from <b>design tokens</b></span>
        <a className="spec request-link" href="https://github.com/robertdonegan/Flood-Icons/issues/new?labels=icon-request&template=icon-request.md&title=Icon+request%3A+" title="Open an icon request on GitHub" target="_blank" rel="noreferrer">request an icon →</a>
      </div>

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
        <div className="control-group">
          <span className="control-label">Sort</span>
          <div className="seg" role="group" aria-label="Sort order">
            {[['newest', 'New'], ['category', 'Category'], ['name', 'Name']].map(([v, label]) => (
              <button key={v} aria-pressed={sortBy === v} onClick={() => setSortBy(v)}>{label}</button>
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
              {visible.map((icon, i) => {
                const prev = visible[i - 1];
                const showDivider = sortBy === 'category' && (!prev || prev.category !== icon.category);
                return (
                  <React.Fragment key={icon.style + icon.id}>
                    {showDivider && (
                      <div className="category-divider" role="separator">
                        <span>{icon.category}</span>
                      </div>
                    )}
                    <div
                      className="tile"
                      data-active={activeId === uid(icon)}
                      data-selected={selected.has(uid(icon))}
                      onClick={(e) => (e.metaKey || e.ctrlKey ? toggleSelect(uid(icon)) : setActiveId(uid(icon)))}
                      onMouseEnter={() => (hoveredRef.current = icon)}
                      onMouseLeave={() => { if (hoveredRef.current && uid(hoveredRef.current) === uid(icon)) hoveredRef.current = null; }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setActiveId(uid(icon))}
                      title={`${icon.name} — click for detail, ⌘/Ctrl-click to select, C to copy SVG`}
                    >
                      <button
                        className="select-box"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(uid(icon)); }}
                        aria-label={`Select ${icon.name}`}
                      >
                        {selected.has(uid(icon)) && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"><path d="m4.5 12.5 5 5 10-11" /></svg>
                        )}
                      </button>
                      <span className="style-dot" data-style={icon.style} title={icon.style} />
                      {isNew(icon) && <span className="new-badge">new</span>}
                      <Glyph icon={icon} size={previewSize} />
                      <span className="label">{icon.name}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </main>

        {active && (
          <aside className="detail" aria-label={`${active.name} detail`}>
            <button className="close" onClick={() => setActiveId(null)} aria-label="Close panel">✕</button>
            <button
              className="icon-btn link-btn"
              title="Copy a shareable link to this icon"
              aria-label="Copy link to this icon"
              onClick={async () => {
                const url = new URL(window.location.href);
                url.searchParams.set('style', active.style);
                url.searchParams.set('icon', active.id);
                await navigator.clipboard.writeText(url.toString());
                flash('Link copied to clipboard');
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" /><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" /></svg>
            </button>
            <h2>{active.name}</h2>
            <div className="meta">{active.style} · {active.category} · {active.id}.svg</div>

            <div className="preview-pair">
              <div className="preview-cell" data-mode="light">
                <ThemedGlyph icon={active} tokens={tokens} mode="light" size={56} />
                <span className="tag">light</span>
              </div>
              <div className="preview-cell" data-mode="dark">
                <ThemedGlyph icon={active} tokens={tokens} mode="dark" size={56} />
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
              {[12, 16, 20, 32].map((s) => (
                <button key={s} className="btn" onClick={() => runExport([active], { formats: ['png'], sizes: [s], themes: [theme], tokens, scale: 1 })}>PNG {s}px</button>
              ))}
              <button className="btn" onClick={() => runExport([active], { formats: ['png'], sizes: [12, 16, 20, 32], themes: [theme], tokens, scale: 2 })}>PNG all @2x</button>
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
                {[12, 16, 20, 32].map((s) => (
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

      {showChangelog && (
        <div className="modal-overlay" onClick={() => setShowChangelog(false)}>
          <div className="modal changelog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Icon changelog">
            <button className="close" onClick={() => setShowChangelog(false)} aria-label="Close changelog">✕</button>
            <h2>Changelog</h2>
            <div className="meta">Auto-generated from git history — every commit that added, updated or removed an icon.</div>
            {!changelog ? (
              <div className="empty">Loading…</div>
            ) : changelog.entries.length === 0 ? (
              <div className="empty">No icon changes recorded yet.</div>
            ) : (
              <div className="changelog-list">
                {changelog.entries.map((entry) => (
                  <div className="changelog-entry" key={entry.commit}>
                    <div className="changelog-head">
                      <span className="changelog-date">
                        {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="changelog-msg">{entry.message}</span>
                    </div>
                    <ul className="changelog-changes">
                      {entry.changes.map((c, i) => (
                        <li key={i} data-type={c.type}>
                          <span className={`badge badge-${c.type}`}>{c.type}</span>
                          {c.name} <span className="changelog-style">· {c.style}{c.category ? ` · ${c.category}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
