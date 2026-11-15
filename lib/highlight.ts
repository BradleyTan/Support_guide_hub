/**
 * Shows why a search result matched: the search words are marked in its text, and a guide lists the parts that
 * contain them. Word-level only — a "similar meaning" match may have nothing to mark, which is fine.
 */

const FILLER = new Set(["the", "and", "for", "with", "not", "are", "was", "how", "what", "why", "when", "can", "cannot", "this", "that", "from", "into", "you", "your"]);
const MIN_STEM = 3;
const NUMBER = /^\p{N}+$/u;

/**
 * The start of a word that its other forms share: "posted"/"posting" → "post", "reconciliation" → "reconcil".
 * Kept deliberately cautious so different words aren't marked: "dates" → "date" (not "dat", which marks "data"),
 * "settings" → "setting" (not "sett", which marks "settlement"), "cases" → "case" (not "cas", which marks "cash"), "taxes" → "tax".
 * Numbers are matched whole, so "20" doesn't mark "2026".
 */
function stem(word: string): string {
  if (NUMBER.test(word)) return word;
  const cut = (suffix: string, min = MIN_STEM) => (word.endsWith(suffix) && word.length - suffix.length >= min ? word.slice(0, -suffix.length) : null);
  return (
    cut("iations") ??
    cut("ations") ??
    cut("iation") ??
    cut("ation") ??
    (word.endsWith("ings") ? word.slice(0, -1) : null) ??
    cut("ing", 4) ??
    cut("ed") ??
    (/(?:x|z|ch|sh)es$/.test(word) ? cut("es") : null) ??
    (word.endsWith("ss") ? null : cut("s")) ??
    word
  );
}

/** The search words worth marking: lower-cased, no duplicates, no very short or filler words. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const kept = words.filter((w) => (/^\p{N}+$/u.test(w) ? w.length >= 2 : w.length >= 3) && !FILLER.has(w));
  return [...new Set(kept)];
}

function matches(word: string, stems: string[]): boolean {
  const w = word.toLowerCase();
  return stems.some((s) => (NUMBER.test(s) ? w === s : w.startsWith(s)));
}

export type Part = { text: string; hit: boolean };

/** Splits text into marked and unmarked parts. A word is marked when it starts with a search word's stem. */
export function highlightParts(text: string, terms: string[]): Part[] {
  if (!text) return [];
  const stems = terms.map(stem);
  if (!stems.length) return [{ text, hit: false }];
  const parts: Part[] = [];
  for (const piece of text.split(/([\p{L}\p{N}]+)/u)) {
    if (!piece) continue;
    const hit = /[\p{L}\p{N}]/u.test(piece) && matches(piece, stems);
    const last = parts[parts.length - 1];
    if (last && last.hit === hit && !hit) last.text += piece;
    else parts.push({ text: piece, hit });
  }
  return parts;
}

function contains(text: string | undefined, stems: string[]): boolean {
  return !!text && (text.match(/[\p{L}\p{N}]+/gu) ?? []).some((w) => matches(w, stems));
}

type GuideText = { title: string; errorMessage?: string; symptom?: string; cause?: string; steps: string[] };

/** Which parts of a guide contain a search word, in reading order. */
export function foundIn(g: GuideText, terms: string[]): string[] {
  const stems = terms.map(stem);
  if (!stems.length) return [];
  const fields: [string, string | undefined][] = [
    ["title", g.title],
    ["error message", g.errorMessage],
    ["symptom", g.symptom],
    ["cause", g.cause],
    ["fix steps", g.steps.join("\n")],
  ];
  return fields.filter(([, text]) => contains(text, stems)).map(([name]) => name);
}
