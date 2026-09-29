import type { Guide, JournalEntry } from "@/lib/types";

export function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function topTags(guides: Guide[], n = 6) {
  return countBy(guides.flatMap((g) => g.tags), (t) => t).slice(0, n);
}

export function recentlyUpdated(guides: Guide[], n = 5) {
  return [...guides].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, n);
}

export function mostUsed(guides: Guide[], n = 5) {
  return [...guides].sort((a, b) => b.uses - a.uses).slice(0, n);
}

export function unverified(guides: Guide[]) {
  return guides.filter((g) => !g.verified);
}

const STOPWORDS = new Set(["the", "and", "for", "not", "was", "can", "cannot", "can't", "does", "doesn", "with", "after", "when", "from", "this", "that", "are", "has", "have", "found", "error", "occurred", "while"]);

function tokens(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Prototype keyword ranking over title, error, symptom and tags.
 * Phase 3 replaces this with Postgres full-text + pgvector (hybrid, RRF).
 */
export function searchGuides(guides: Guide[], query: string) {
  const q = tokens(query);
  if (!q.length) return [];
  return guides
    .map((g) => {
      const title = tokens(g.title);
      const body = tokens(`${g.errorMessage ?? ""} ${g.symptom} ${g.cause ?? ""} ${g.module}`);
      const tags = g.tags.flatMap((t) => tokens(t.replace(/-/g, " ")));
      let score = 0;
      for (const t of q) {
        if (title.includes(t)) score += 3;
        if (tags.includes(t)) score += 2;
        if (body.includes(t)) score += 1;
      }
      return { guide: g, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Journal totals and whether Dr equals Cr (to the cent). */
export function journalTotals(entry: JournalEntry) {
  const dr = entry.lines.reduce((s, l) => s + (l.dr ?? 0), 0);
  const cr = entry.lines.reduce((s, l) => s + (l.cr ?? 0), 0);
  return { dr, cr, balanced: Math.round(dr * 100) === Math.round(cr * 100) };
}

export function shortProduct(p: string) {
  return p.replace("AutoCount ", "");
}
