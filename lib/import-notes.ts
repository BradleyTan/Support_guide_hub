import { normalizeProduct } from "@/lib/import";

/**
 * Support notes written as plain text (a .txt file, or text read out of a PDF):
 *
 *   Issue: AutoCount Accounting - e-Invoice status Invalid, Buyer TIN is invalid
 *   Solution: Make sure the TIN is correct using the Search TIN function. …
 *
 *   Issue: AutoCount Payroll - …
 *   Solution: …
 *
 * Each Issue/Solution pair becomes one row with the columns below, so the import wizard can review
 * and import it exactly like a spreadsheet row. Pure functions: no browser or database access.
 */

export const NOTE_HEADERS = ["Title", "Product", "Symptom", "Fix steps"] as const;
/** Longer issue text is shortened for the title; the full text is kept in Symptom. */
export const NOTE_TITLE_MAX = 200;

export interface NoteEntry {
  title: string;
  product: string; // as written, e.g. "AutoCount Accounting"; empty if the issue line names none
  symptom: string;
  steps: string; // one step per line
}

/** "Issue:" at the start of a line. Text read from some PDFs has no line breaks; then any "Issue:" counts. */
const ISSUE_AT_LINE_START = /^[ \t]*issue\s*:/gim;
const ISSUE_ANYWHERE = /\bissue\s*:/gi;
const SOLUTION = /\bsolution\s*:/i;

/** Collapses runs of spaces and tabs but keeps line breaks. */
function tidy(s: string) {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function shorten(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

/**
 * "AutoCount Accounting - text", "AutoCount Accounting (Product) - text" or "Payroll – text":
 * the part before the first dash is the product only if it is a product name we recognise.
 */
function splitProduct(issue: string): { product: string; rest: string } {
  const m = issue.match(/^([^\n]{1,60}?)\s+[-–—]\s+([\s\S]+)$/);
  if (m) {
    const candidate = m[1].replace(/\(\s*product\s*\)/i, "").trim();
    if (normalizeProduct(candidate)) return { product: candidate, rest: m[2].trim() };
  }
  return { product: "", rest: issue };
}

/** Solution text as fix steps: one per line, and "1. … 2. …" written on one line is split too. */
function solutionSteps(solution: string) {
  return tidy(solution)
    .split("\n")
    .flatMap((line) => line.split(/\s+(?=\d{1,2}[.)]\s)/))
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

export function parseNotes(text: string): NoteEntry[] {
  const lineStarts = text.trim().includes("\n") ? [...text.matchAll(ISSUE_AT_LINE_START)] : [];
  const matches = lineStarts.length ? lineStarts : [...text.matchAll(ISSUE_ANYWHERE)];
  const starts = matches.map((m) => ({ at: m.index!, len: m[0].length }));
  return starts.map(({ at, len }, i) => {
    const block = text.slice(at + len, i + 1 < starts.length ? starts[i + 1].at : undefined);
    const s = block.search(SOLUTION);
    const issueText = tidy(s < 0 ? block : block.slice(0, s)).replace(/\n/g, " ");
    const solution = s < 0 ? "" : block.slice(s).replace(SOLUTION, "");
    const { product, rest } = splitProduct(issueText);
    const title = shorten(rest, NOTE_TITLE_MAX);
    return { title, product, symptom: title === rest ? "" : rest, steps: solutionSteps(solution) };
  });
}

/** Rebuilds a PDF's text from its text pieces, keeping the line breaks (pages are separated by a line break). */
export function pdfItemsToText(pages: { str: string; hasEOL: boolean }[][]) {
  return pages.map((items) => items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join("")).join("\n");
}

/** The same shape the spreadsheet reader produces: a heading row, then one row per note. */
export function notesToSheet(entries: NoteEntry[]): string[][] {
  return [[...NOTE_HEADERS], ...entries.map((e) => [e.title, e.product, e.symptom, e.steps])];
}
