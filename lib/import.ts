import { guideInputSchema, splitLines, splitTags, type GuideInput } from "@/lib/guide-schema";
import { closestMatch, normalizeTitle } from "@/lib/similarity";
import { CATEGORIES, PRODUCTS, type Category, type Product } from "@/lib/types";

/** Pure helpers for the Excel/CSV import wizard (no browser or database access, so they're unit-testable). */

export const IMPORT_FIELDS = ["title", "product", "version", "module", "category", "symptom", "errorMessage", "cause", "steps", "prevention", "tags"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type Mapping = (ImportField | "skip")[];

export const FIELD_LABEL: Record<ImportField | "skip", string> = {
  title: "Title",
  product: "Product",
  version: "Version",
  module: "Module",
  category: "Category",
  symptom: "Symptom",
  errorMessage: "Error message",
  cause: "Cause",
  steps: "Fix steps",
  prevention: "Prevention",
  tags: "Tags",
  skip: "Skip this column",
};

/** Common column names people use in support logs, per field. Checked after exact label matches. */
const SYNONYMS: Record<ImportField, string[]> = {
  title: ["title", "issue", "subject", "problem", "summary", "case", "topic", "question"],
  product: ["product", "software", "system", "application", "app"],
  version: ["version", "ver", "build", "release"],
  module: ["module", "area", "feature", "screen", "function"],
  category: ["category", "type", "group", "classification"],
  symptom: ["symptom", "description", "details", "detail", "complaint", "issue details"],
  errorMessage: ["error", "error message", "error msg", "message", "error text"],
  cause: ["cause", "root cause", "reason", "why"],
  steps: ["solution", "fix", "steps", "resolution", "action", "answer", "workaround", "fix steps", "solution steps"],
  prevention: ["prevention", "remarks", "remark", "note", "notes", "advice", "tip"],
  tags: ["tags", "tag", "keywords", "labels"],
};

/** Guesses which field each column holds. Each field is used at most once; unknown columns are skipped. */
export function autoMapColumns(headers: string[]): Mapping {
  const used = new Set<ImportField>();
  const norm = headers.map((h) => normalizeTitle(String(h ?? "")));
  const result: Mapping = headers.map(() => "skip");

  const pass = (match: (h: string, words: string[]) => boolean) => {
    norm.forEach((h, i) => {
      if (result[i] !== "skip" || !h) return;
      const field = IMPORT_FIELDS.find((f) => !used.has(f) && match(h, SYNONYMS[f]));
      if (field) {
        result[i] = field;
        used.add(field);
      }
    });
  };
  pass((h, words) => words.includes(h)); // exact
  pass((h, words) => words.some((w) => h.startsWith(w + " ") || h.endsWith(" " + w))); // e.g. "Issue title", "Solution / steps"
  return result;
}

const PRODUCT_ALIASES: [RegExp, Product][] = [
  [/account\s*book/i, "AutoCount Account Book"],
  [/payroll|hrms|hr\b/i, "AutoCount Payroll"],
  [/\bpos\b|point\s*of\s*sale/i, "AutoCount POS"],
  [/accounting|\bac\b|\baca\b/i, "AutoCount Accounting"],
];

export function normalizeProduct(value: string): Product | null {
  const v = value.trim();
  if (!v) return null;
  const exact = PRODUCTS.find((p) => p.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  return PRODUCT_ALIASES.find(([re]) => re.test(v))?.[1] ?? null;
}

export function normalizeCategory(value: string): Category | null {
  const v = normalizeTitle(value);
  if (!v) return null;
  return CATEGORIES.find((c) => normalizeTitle(c) === v) ?? CATEGORIES.find((c) => normalizeTitle(c).includes(v) || v.includes(normalizeTitle(c).split(" ")[0])) ?? null;
}

/** Fix steps: one per line; a single line with semicolons is split on the semicolons. */
export function parseSteps(value: string) {
  const lines = splitLines(value);
  if (lines.length === 1 && lines[0].includes(";")) return lines[0].split(";").map((s) => s.trim()).filter(Boolean);
  return lines;
}

export type RowStatus = "ok" | "duplicate" | "error";

export interface ReviewedRow {
  rowNumber: number; // as shown in Excel (header is row 1)
  input: Partial<GuideInput>;
  status: RowStatus;
  problems: string[];
  duplicateOf?: { code: string; title: string };
}

/**
 * Turns raw sheet rows into guide inputs, checking each against the guide rules and against
 * existing guides and earlier rows in the same file for likely duplicates.
 */
export function reviewRows(
  rows: unknown[][],
  mapping: Mapping,
  options: { defaultProduct?: Product; existing: { code: string; title: string }[]; firstRowNumber?: number },
): ReviewedRow[] {
  const first = options.firstRowNumber ?? 2;
  const seen: { code: string; title: string }[] = [];
  return rows.flatMap((cells, i): ReviewedRow[] => {
    const get = (field: ImportField) => {
      const idx = mapping.indexOf(field);
      return idx < 0 ? "" : String(cells[idx] ?? "").trim();
    };
    if (cells.every((c) => String(c ?? "").trim() === "")) return []; // blank line in the sheet

    const problems: string[] = [];
    const productText = get("product");
    const product = normalizeProduct(productText) ?? (productText ? null : (options.defaultProduct ?? null));
    if (!product) problems.push(productText ? `Unknown product “${productText}”` : "No product");

    const categoryText = get("category");
    const category = normalizeCategory(categoryText);

    const input: Partial<GuideInput> = {
      title: get("title"),
      product: product ?? undefined,
      version: get("version"),
      module: get("module"),
      category,
      symptom: get("symptom"),
      errorMessage: get("errorMessage"),
      cause: get("cause"),
      steps: parseSteps(get("steps")),
      prevention: get("prevention"),
      tags: splitTags(get("tags")),
    };

    const check = guideInputSchema.safeParse(input);
    if (!check.success) for (const issue of check.error.issues) if (issue.path[0] !== "product") problems.push(issue.message);
    const rowNumber = first + i;

    if (problems.length || !check.success) return [{ rowNumber, input, status: "error", problems }];

    const dup = closestMatch(check.data.title, [...options.existing, ...seen]);
    seen.push({ code: `row ${rowNumber}`, title: check.data.title });
    const note = categoryText && !category ? [`Category “${categoryText}” not recognised; left blank`] : [];
    if (dup) return [{ rowNumber, input: check.data, status: "duplicate", problems: note, duplicateOf: dup.item }];
    return [{ rowNumber, input: check.data, status: "ok", problems: note }];
  });
}

/** Finds the header row: the first row with at least two non-empty text cells. */
export function splitHeader(sheet: unknown[][]): { headers: string[]; rows: unknown[][]; firstRowNumber: number } | null {
  const idx = sheet.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 2);
  if (idx < 0) return null;
  return { headers: sheet[idx].map((c) => String(c ?? "").trim()), rows: sheet.slice(idx + 1), firstRowNumber: idx + 2 };
}
