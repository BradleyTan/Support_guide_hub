import { describe, expect, it } from "vitest";
import { EXCEL_CELL_MAX, analysesSheet, exportFileName, fitCell, guidesSheet, releaseNotesSheet, sopsSheet, templatesSheet } from "@/lib/export";
import { autoMapColumns, reviewRows, splitHeader } from "@/lib/import";
import { guideToInput } from "@/lib/guide-schema";
import { guides } from "@/lib/mock/guides";
import { analyses } from "@/lib/mock/analyses";
import { releaseNotes, templates } from "@/lib/mock/library";

describe("guides export", () => {
  it("can be imported again with every field intact", () => {
    const table = splitHeader(guidesSheet(guides).rows)!;
    const mapping = autoMapColumns(table.headers);
    // The extra columns (guide no., verified, opened, dates) aren't guide fields and are skipped.
    expect(mapping.slice(11)).toEqual(["skip", "skip", "skip", "skip", "skip"]);
    const back = reviewRows(table.rows, mapping, { existing: [] });
    expect(back.map((r) => r.status === "error" ? r.problems : "ok")).toEqual(guides.map(() => "ok"));
    back.forEach((r, i) => expect(r.input).toEqual(guideToInput(guides[i])));
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
    expect(releaseNotesSheet(releaseNotes).rows[1][5]).toBe(releaseNotes[0].guideIds.join(", "));
    const sop = { id: "SOP-1", dbId: "x", guideCode: "G-1001", title: "T", version: "2.1", purpose: "P", scope: "S", steps: [{ text: "A", attachmentId: null }, { text: "B", attachmentId: null }], checks: ["C1", "C2"], updatedAt: "2026-10-02T03:00:00Z" };
    expect(sopsSheet([sop]).rows[1]).toEqual(["SOP-1", "T", "G-1001", "2.1", "S", "P", "1. A\n2. B", "C1\nC2", "2026-10-02"]);
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
