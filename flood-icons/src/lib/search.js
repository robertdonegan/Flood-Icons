/**
 * Weighted icon search.
 * Matches, in order of weight: exact name → name prefix → name substring →
 * tag → synonym → category → fuzzy subsequence (catches typos like "culvrt").
 */
function subsequenceScore(query, target) {
  // Cheap fuzzy: does every char of query appear in order in target?
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length ? query.length / target.length : 0;
}

export function searchIcons(icons, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return icons;

  const terms = q.split(/\s+/);
  const scored = [];

  for (const icon of icons) {
    const name = icon.name.toLowerCase();
    const id = icon.id.toLowerCase();
    let total = 0;

    for (const term of terms) {
      let best = 0;
      if (name === term || id === term) best = 100;
      else if (name.startsWith(term) || id.startsWith(term)) best = 60;
      else if (name.includes(term) || id.includes(term)) best = 40;

      for (const t of icon.tags) {
        const tl = t.toLowerCase();
        if (tl === term) best = Math.max(best, 50);
        else if (tl.includes(term)) best = Math.max(best, 30);
      }
      for (const s of icon.synonyms) {
        const sl = s.toLowerCase();
        if (sl === term) best = Math.max(best, 45);
        else if (sl.includes(term)) best = Math.max(best, 25);
      }
      if (icon.category.toLowerCase().includes(term)) best = Math.max(best, 20);

      // Fuzzy fallback for typos / partial recall
      if (best === 0 && term.length >= 3) {
        best = Math.max(
          subsequenceScore(term, id) * 15,
          ...icon.tags.map((t) => subsequenceScore(term, t.toLowerCase()) * 10)
        );
      }
      total += best;
    }
    if (total > 0) scored.push({ icon, total });
  }

  return scored.sort((a, b) => b.total - a.total).map((s) => s.icon);
}
