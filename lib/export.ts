import { PLATFORM_LABELS, type Analysis, type Guide, type Template } from "@/lib/types";
import type { Sop } from "@/lib/sop";
import { NOT_FOUND_STEPS, type KnowledgeArticle } from "@/lib/knowledge/model";

/**
 * Rows for the Excel exports (pure: no browser or database access). The Guides sheet uses the same column
 * names as the import template, so an exported file can be imported again (extra columns are skipped there).
 */

export type Sheet = { name: string; rows: (string | number | boolean)[][] };

const day = (iso: string) => iso.slice(0, 10);
const numbered = (items: string[]) => items.map((s, i) => `${i + 1}. ${s}`).join("\n");

export const GUIDE_HEADERS = ["Title", "Product", "Platform", "Version", "Module", "Category", "Symptom", "Error message", "Cause", "Fix steps", "Prevention", "Tags", "Guide no.", "Verified", "Opened", "Created", "Updated"] as const;

export function guidesSheet(guides: Guide[]): Sheet {
  return {
    name: "Guides",
    rows: [
      [...GUIDE_HEADERS],
      ...guides.map((g) => [
        g.title,
        g.product,
        PLATFORM_LABELS[g.platform],
        g.version,
        g.module,
        g.category ?? "",
        g.symptom,
        g.errorMessage ?? "",
        g.cause ?? "",
        numbered(g.steps),
        g.prevention ?? "",
        g.tags.join(", "),
        g.id,
        g.verified ? "Yes" : "No",
        g.uses,
        day(g.createdAt),
        day(g.updatedAt),
      ]),
    ],
  };
}

export function analysesSheet(analyses: Analysis[]): Sheet {
  return {
    name: "Analyses",
    rows: [
      ["Analysis no.", "Title", "Date", "Scenario", "Treatment", "Journal entries", "Tax points", "Needs verification"],
      ...analyses.map((a) => [
        a.id,
        a.title,
        day(a.createdAt),
        a.scenario,
        [a.treatment.standard, ...a.treatment.points].filter(Boolean).join("\n"),
        a.entries
          .map((e) => [`${e.date} ${e.description}`, ...e.lines.map((l) => (l.dr ? `Dr ${l.account} ${l.dr.toFixed(2)}` : `Cr ${l.account} ${(l.cr ?? 0).toFixed(2)}`))].join("\n"))
          .join("\n\n"),
        a.tax.join("\n"),
        a.needsVerification.join("\n"),
      ]),
    ],
  };
}

export function templatesSheet(templates: Template[]): Sheet {
  return { name: "Templates", rows: [["Type", "Name", "Text", "Tags", "Used"], ...templates.map((t) => [t.kind, t.title, t.body, t.tags.join(", "), t.uses])] };
}

export function sopsSheet(sops: Sop[]): Sheet {
  return {
    name: "SOPs",
    rows: [
      ["SOP no.", "Title", "From guide", "Version", "Applies to", "Purpose", "Steps", "Checks", "Updated"],
      ...sops.map((s) => [s.id, s.title, s.guideCode ?? "", s.version, s.scope, s.purpose, numbered(s.steps.map((x) => x.text)), s.checks.join("\n"), day(s.updatedAt)]),
    ],
  };
}

export function knowledgeSheet(articles: KnowledgeArticle[]): Sheet {
  return {
    name: "Knowledge hub",
    rows: [
      ["Title", "Category", "Tell the customer", "What it is", "Example", "Desktop", "Cloud", "Common mistakes", "Sources", "Reviewed", "Updated"],
      ...articles.map((a) => [
        a.title,
        a.category,
        a.tellCustomer,
        a.whatItIs,
        a.example,
        a.desktopSteps ?? NOT_FOUND_STEPS,
        a.cloudSteps ?? NOT_FOUND_STEPS,
        a.mistakes.join("\n"),
        a.sources.map((s) => `${s.label}: ${s.url}`).join("\n"),
        a.reviewed ? "Yes" : "No",
        day(a.updatedAt),
      ]),
    ],
  };
}

/** Excel refuses cells over 32,767 characters; anything longer is cut with a note rather than failing the file. */
export const EXCEL_CELL_MAX = 32_767;
export function fitCell(v: string | number | boolean) {
  return typeof v === "string" && v.length > EXCEL_CELL_MAX ? v.slice(0, EXCEL_CELL_MAX - 20) + " …[cut for Excel]" : v;
}

/** File name with today's date, e.g. support-desk-guides-2026-10-02.xlsx */
export function exportFileName(what: string, today = new Date()) {
  const d = today.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }); // yyyy-mm-dd
  return `support-desk-${what}-${d}.xlsx`;
}
