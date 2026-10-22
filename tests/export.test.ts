import { describe, expect, it } from "vitest";
import { EXCEL_CELL_MAX, analysesSheet, exportFileName, fitCell, guidesSheet, knowledgeSheet, sopsSheet, templatesSheet } from "@/lib/export";
import { rowToArticle, starterToRow } from "@/lib/knowledge/model";
import { STARTER_ARTICLES } from "@/lib/knowledge/starter";
import { autoMapColumns, reviewRows, splitHeader } from "@/lib/import";
import { guideToInput } from "@/lib/guide-schema";
import { guides } from "@/lib/mock/guides";
import { analyses } from "@/lib/mock/analyses";
import { templates } from "@/lib/mock/library";

describe("guides export", () => {
  it("can be imported again with every field intact", () => {
    const table = splitHeader(guidesSheet(guides).rows)!;
    const mapping = autoMapColumns(table.headers);
    // The extra columns (guide no., verified, opened, dates) aren't guide fields and are skipped.
    expect(mapping.slice(0, 3)).toEqual(["title", "product", "platform"]);
    expect(mapping.slice(12)).toEqual(["skip", "skip", "skip", "skip", "skip"]);
    const back = reviewRows(table.rows, mapping, { existing: [] });
    expect(back.map((r) => r.status === "error" ? r.problems : "ok")).toEqual(guides.map(() => "ok"));
    back.forEach((r, i) => expect(r.input).toEqual(guideToInput(guides[i])));
  });

  it("has a Platform column right after Product", () => {
    const rows = guidesSheet([{ ...guides[0], platform: "both" }]).rows;
    expect(rows[0].slice(1, 3)).toEqual(["Product", "Platform"]);
    expect(rows[1][2]).toBe("Desktop & Cloud");
  });

  it("has one row per guide plus the heading row", () => {
    expect(guidesSheet(guides).rows).toHaveLength(guides.length + 1);
    expect(guidesSheet([]).rows).toHaveLength(1);
  });
});

describe("other sheets", () => {
  it("list every item with readable text", () => {
    const a = analysesSheet(analyses);
    expect(a.rows).toHaveLength(analyses.length + 1);
    expect(String(a.rows[1][5])).toMatch(/^.+\n(Dr|Cr) /); // journal lines spelled out
    expect(templatesSheet(templates).rows[1]).toEqual([templates[0].kind, templates[0].title, templates[0].body, templates[0].tags.join(", "), templates[0].uses]);
    const sop = { id: "SOP-1", dbId: "x", guideCode: "G-1001", title: "T", version: "2.1", purpose: "P", scope: "S", steps: [{ text: "A", attachmentId: null }, { text: "B", attachmentId: null }], checks: ["C1", "C2"], updatedAt: "2026-10-02T03:00:00Z" };
    expect(sopsSheet([sop]).rows[1]).toEqual(["SOP-1", "T", "G-1001", "2.1", "S", "P", "1. A\n2. B", "C1\nC2", "2026-10-02"]);
  });
});

describe("knowledge hub sheet", () => {
  it("lists each article with its customer text, steps (or the not-found line) and sources", () => {
    const s = STARTER_ARTICLES.find((a) => a.slug === "debtor-aging")!;
    const a = rowToArticle({ ...starterToRow(s), id: "x", updated_at: "2026-10-22T01:00:00Z", deleted_at: null });
    const sheet = knowledgeSheet([a]);
    expect(sheet.name).toBe("Knowledge hub");
    expect(sheet.rows[0]).toEqual(["Title", "Category", "Tell the customer", "What it is", "Example", "Desktop", "Cloud", "Common mistakes", "Sources", "Reviewed", "Updated"]);
    expect(sheet.rows[1].slice(0, 3)).toEqual([s.title, s.category, s.tellCustomer]);
    expect(sheet.rows[1][5]).toBe("Not found in a source yet — add it once checked");
    expect(sheet.rows[1][6]).toBe("Accounting Menu > Reports > Debtor Aging");
    expect(String(sheet.rows[1][8])).toContain("https://help.accounting.autocountcloud.com/");
    expect(sheet.rows[1].slice(9)).toEqual(["No", "2026-10-22"]);
  });
});

describe("Excel limits and file names", () => {
  it("cuts text Excel can't hold and leaves everything else alone", () => {
    const long = fitCell("x".repeat(EXCEL_CELL_MAX + 10)) as string;
    expect(long.length).toBeLessThanOrEqual(EXCEL_CELL_MAX);
    expect(long.endsWith("[cut for Excel]")).toBe(true);
    expect(fitCell("short")).toBe("short");
    expect(fitCell(42)).toBe(42);
  });

  it("dates the file in Malaysia time", () => {
    expect(exportFileName("guides", new Date("2026-10-01T17:30:00Z"))).toBe("support-desk-guides-2026-10-02.xlsx");
  });
});
