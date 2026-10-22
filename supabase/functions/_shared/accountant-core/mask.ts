// Hides personal data before a chat leaves the app. Shared by the browser and the ask-accountant Edge Function
// (copied by `npm run sync:core`), so it imports nothing.

/** Placeholder → real value, kept per chat so the same value always gets the same placeholder. */
export type MaskMap = Record<string, string>;

export const PLACEHOLDER = /\[(COMPANY|IC|BANK|PHONE|EMAIL|HIDDEN) \d+\]/g;

type Kind = "COMPANY" | "IC" | "BANK" | "PHONE" | "EMAIL" | "HIDDEN";

// Order matters: an IC or phone number would otherwise also look like a bank account number.
const RULES: { kind: Kind; re: RegExp }[] = [
  { kind: "EMAIL", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: "IC", re: /(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/g },
  { kind: "PHONE", re: /(?<![\d\w])(?:\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/g },
  { kind: "BANK", re: /(?<!\w)(?<!\d[.,])(?<!RM\s?)\d(?:[ -]?\d){9,15}(?!\d|[.,]\d)/g },
  { kind: "COMPANY", re: /(?<![\w[])(?:[A-Z0-9][\w&'.-]*\s+){1,6}(?:Sdn\.?\s+Bhd\.?|Berhad|Bhd\.?|Enterprise|Trading|PLT)(?!\w)/g },
];

function placeholderFor(kind: Kind, value: string, map: MaskMap): string {
  const existing = Object.keys(map).find((p) => map[p] === value);
  if (existing) return existing;
  let n = 1;
  while (`[${kind} ${n}]` in map) n++;
  const p = `[${kind} ${n}]`;
  map[p] = value;
  return p;
}

/** Swaps values already in the map for their placeholders, longest first so "ABC Sdn Bhd" wins over "ABC". */
function applyMap(text: string, map: MaskMap): string {
  const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  for (const [p, v] of entries) if (v) text = text.split(v).join(p);
  return text;
}

/** Masks IC, bank, phone, email and company names. Returns the masked text and the merged map. */
export function autoMask(text: string, map: MaskMap): { text: string; map: MaskMap } {
  const next = { ...map };
  let out = applyMap(text, next);
  for (const { kind, re } of RULES) out = out.replace(re, (m) => placeholderFor(kind, m, next));
  return { text: out, map: next };
}

/** Hides text the user picked (e.g. a person's name) everywhere it appears. */
export function hideSelection(text: string, value: string, map: MaskMap): { text: string; map: MaskMap } {
  const v = value.trim();
  if (!v || !text.includes(v) || v.replace(PLACEHOLDER, "").trim() === "") return { text, map };
  const next = { ...map };
  const p = placeholderFor("HIDDEN", v, next);
  return { text: text.split(v).join(p), map: next };
}

/** Puts the real values back. Unknown placeholders are left as they are. */
export function unmask(text: string, map: MaskMap): string {
  return text.replace(PLACEHOLDER, (p) => map[p] ?? p);
}
