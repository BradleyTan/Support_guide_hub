// Turns the user's guides, Knowledge hub articles and AutoCount help-centre pages into numbered sources for
// the Accountant chat. Shared with the ask-accountant Edge Function.
import type { Platform, Source } from "./answer.ts";

/** Help-centre article pages are the only ones read (robots.txt); /support/search never is. */
const ARTICLE = /^https:\/\/(help\.accounting\.autocountcloud\.com|help\.hrms\.autocountcloud\.com)\/support\/solutions\/articles\/\d+-[\w-]+\/?$/;

export function isFetchableArticle(url: string): boolean {
  return ARTICLE.test(url);
}

export function toGuideSource(row: { id: string; code: string; title: string; symptom: string; cause: string | null; steps: string[]; verified: boolean; platform: string }): Source {
  return {
    id: `g-${row.id}`,
    kind: "my-guide",
    title: row.title,
    url: `/guides/${row.code}`,
    platform: row.platform as Platform,
    checked: row.verified,
    text: [row.title, row.symptom, row.cause ?? "", ...row.steps].filter(Boolean).join("\n"),
  };
}

/**
 * An article's explanation (no platform, so it can never confirm a menu path) plus its Desktop and Cloud
 * paths as separate sources, checked only once the user has ticked "steps verified".
 */
export function toKnowledgeSources(row: {
  id: string;
  title: string;
  tell_customer: string;
  what_it_is: string;
  desktop_steps: string | null;
  cloud_steps: string | null;
  steps_verified: boolean;
  reviewed: boolean;
}): Source[] {
  const base = { kind: "knowledge" as const, title: row.title, url: `/knowledge/${row.id}` };
  const list: Source[] = [{ ...base, id: `k-${row.id}`, platform: null, checked: row.reviewed, text: `${row.tell_customer}\n${row.what_it_is}`.trim() }];
  if (row.desktop_steps) list.push({ ...base, id: `k-${row.id}-d`, title: `${row.title} (Desktop steps)`, platform: "desktop", checked: row.steps_verified, text: row.desktop_steps });
  if (row.cloud_steps) list.push({ ...base, id: `k-${row.id}-c`, title: `${row.title} (Cloud steps)`, platform: "cloud", checked: row.steps_verified, text: row.cloud_steps });
  return list;
}

export function toOfficialSource(page: { url: string; title: string; snippet: string }, bodyText: string): Source {
  return { id: page.url, kind: "official", title: page.title, url: page.url, platform: "cloud", checked: true, text: bodyText.trim() || page.snippet };
}

/** Readable text from an article page: scripts and styles dropped, block ends become new lines, entities decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const STOPWORDS = new Set(
  "the and but for not nor you your yours our ours their them they she him her his its this that these those with from into onto over under about after before then than when what which who whom how why where there here have has had was were are been being will would should could can may might must does did doing done just also only very too still already now ago year years month months week weeks day days last next want wants wanted need needs needed customer customers client clients received receive got get gets give gave make made take took use used using never ever any some all each every other another same such more most less much many few one two three off out per via".split(" "),
);

/**
 * A short keyword search from a long scenario: up to 8 distinct words joined with " or " (websearch syntax),
 * leaving out placeholders like [COMPANY 1], numbers and filler words. "" when nothing useful is left.
 */
export function searchQuery(text: string): string {
  const words = text
    .replace(/\[[A-Z]+ \d+\]/g, " ")
    .toLowerCase()
    .match(/[a-z][a-z-]{2,}/g) ?? [];
  const picked: string[] = [];
  for (const w of words) if (!STOPWORDS.has(w) && !picked.includes(w) && picked.length < 8) picked.push(w);
  return picked.join(" or ");
}

/** The article part of a help-centre page (Freshdesk marks it "article-body"); the whole page when unmarked. */
export function articleBody(html: string): string {
  const start = html.search(/<[^>]+(?:class|id)=["'][^"']*article-body[^"']*["'][^>]*>/i);
  if (start < 0) return html;
  const rest = html.slice(start);
  const end = rest.search(/<footer\b|<\/article>|class=["'][^"']*article-(?:vote|feedback)/i);
  return end > 0 ? rest.slice(0, end) : rest;
}
