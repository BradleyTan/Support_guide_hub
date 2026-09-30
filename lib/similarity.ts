/** Lower-case, strip punctuation and collapse spaces, so "SQL Server – not found!" ≈ "sql server not found". */
export function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function trigrams(s: string) {
  const padded = `  ${normalizeTitle(s)} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

/** Trigram similarity (0–1), the same idea as Postgres pg_trgm, so browser and database checks agree. */
export function titleSimilarity(a: string, b: string) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.6;

/** The closest existing title at or above the duplicate threshold, if any. */
export function closestMatch<T extends { title: string }>(title: string, existing: T[]) {
  let best: { item: T; score: number } | null = null;
  for (const item of existing) {
    const score = titleSimilarity(title, item.title);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { item, score };
  }
  return best;
}
