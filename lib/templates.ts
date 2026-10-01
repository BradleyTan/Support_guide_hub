import { z } from "zod";
import { journalTotals } from "@/lib/guide-utils";
import type { Analysis, Guide, TemplateKind } from "@/lib/types";

/** Pure helpers for templates and the reply generator (no browser or database access). */

export const TEMPLATE_KINDS = ["Reply", "SQL", "Checklist"] as const satisfies readonly TemplateKind[];

export const templateInputSchema = z.object({
  kind: z.enum(TEMPLATE_KINDS),
  title: z.string().trim().min(1, "Give the template a name.").max(200, "Keep the name under 200 characters."),
  body: z.string().trim().min(1, "The template is empty.").max(10000, "Keep the template under 10,000 characters."),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(20).default([]),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

/** What each {placeholder} in a reply template is filled with. */
export const PLACEHOLDERS = [
  { key: "contact", label: "Client’s name", hint: "typed in the Reply generator" },
  { key: "title", label: "Guide or analysis title" },
  { key: "product", label: "Product", hint: "e.g. AutoCount Accounting" },
  { key: "version", label: "AutoCount version" },
  { key: "cause", label: "Cause" },
  { key: "steps", label: "Fix steps, numbered" },
  { key: "prevention", label: "Prevention" },
  { key: "entries", label: "Journal entries", hint: "from an analysis" },
  { key: "treatment", label: "Accounting treatment points", hint: "from an analysis" },
] as const;
export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];
export type ReplyValues = Partial<Record<PlaceholderKey, string>>;

/** Used when you have no reply templates of your own yet. */
export const DEFAULT_REPLY_TEMPLATE = `Hi {contact},

Thank you for contacting us about: {title}.

This happens because {cause}

Please follow these steps:
{steps}

{entries}

To prevent this in future: {prevention}

Please let us know if you need any further help.`;

const PLACEHOLDER = /\{([a-z]+)\}/g;

/**
 * Fills {placeholders}. A line whose placeholders are all empty is left out (e.g. no cause → no
 * "This happens because" line), extra blank lines are collapsed, and unknown {words} are kept as typed.
 */
export function fillTemplate(body: string, values: ReplyValues) {
  const known = new Set<string>(PLACEHOLDERS.map((p) => p.key));
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const keys = [...line.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => known.has(k));
    if (keys.length && keys.every((k) => !values[k as PlaceholderKey]?.trim())) continue;
    out.push(line.replace(PLACEHOLDER, (whole, k: string) => (known.has(k) ? (values[k as PlaceholderKey] ?? "").trim() : whole)));
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Placeholders each kind of source can fill; the others never apply to it. */
const SOURCE_KEYS: Record<"guide" | "analysis", PlaceholderKey[]> = {
  guide: ["contact", "title", "product", "version", "cause", "steps", "prevention"],
  analysis: ["contact", "title", "entries", "treatment"],
};

/**
 * Placeholders in a template that this source could fill but has no value for (shown as a hint, not an
 * error). Placeholders the source can never fill (e.g. {entries} for a guide) aren't listed.
 */
export function unfilledPlaceholders(body: string, values: ReplyValues, source: "guide" | "analysis" = "guide") {
  const applies = new Set<string>(SOURCE_KEYS[source]);
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((k) => applies.has(k) && !values[k as PlaceholderKey]?.trim());
}

export const numbered = (items: string[]) =>
  items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

/** Ends a sentence-like value with a full stop so "This happens because {cause}" reads well. */
const sentence = (s?: string | null) => {
  const t = (s ?? "").trim();
  return t && !/[.!?]$/.test(t) ? `${t}.` : t;
};

export function guideValues(g: Guide, contact: string): ReplyValues {
  return {
    contact,
    title: g.title,
    product: g.product,
    version: g.version,
    cause: sentence(g.cause),
    steps: numbered(g.steps),
    prevention: sentence(g.prevention),
  };
}

const rm = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Journal entries as plain text a client can read in an email. */
export function entriesText(a: Pick<Analysis, "entries">) {
  return a.entries
    .map((e) => {
      const t = journalTotals(e);
      const lines = e.lines.map((l) => (l.dr ? `  Dr ${l.account}  RM ${rm(l.dr)}` : `      Cr ${l.account}  RM ${rm(l.cr ?? 0)}`));
      return [`${e.date}: ${e.description}`, ...lines, `  (Total Dr RM ${rm(t.dr)} = Cr RM ${rm(t.cr)})`].join("\n");
    })
    .join("\n\n");
}

export function analysisValues(a: Analysis, contact: string): ReplyValues {
  return {
    contact,
    title: a.title,
    entries: a.entries.length ? `The entries are:\n${entriesText(a)}` : "",
    treatment: a.treatment.points.map((p) => `• ${p}`).join("\n"),
  };
}

export type Channel = "email" | "whatsapp";

/**
 * WhatsApp layout: lines that end with ":" become *bold* headings, bullets use "•",
 * and there are no double blank lines. Email keeps the text as written.
 */
export function formatForChannel(text: string, channel: Channel) {
  if (channel === "email") return text;
  return text
    .split("\n")
    .map((line) => {
      const t = line.trimEnd();
      if (/^[^\s*].{0,80}:$/.test(t) && !/^\d+\./.test(t)) return `*${t}*`;
      return t.replace(/^(\s*)[-*]\s+/, "$1• ");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
