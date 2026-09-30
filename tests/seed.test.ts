import { describe, expect, it } from "vitest";
import { analysisToRow, guideToRow, remapGuideRefs, releaseNoteToRow, templateToRow } from "@/lib/seed";
import { analysisResultSchema } from "@/lib/analysis-schema";
import { guides } from "@/lib/mock/guides";
import { analyses } from "@/lib/mock/analyses";
import { releaseNotes, templates } from "@/lib/mock/library";

describe("seed mapping", () => {
  it("maps every sample guide to a row the database accepts", () => {
    for (const g of guides) {
      const row = guideToRow(g);
      expect(row.title.trim().length).toBeGreaterThan(0);
      expect(row.title.length).toBeLessThanOrEqual(300);
      expect(row.product).toMatch(/^AutoCount /);
      expect(row.steps!.length).toBeGreaterThan(0);
      expect(row).not.toHaveProperty("id"); // the database assigns ids and G- numbers
      expect(row).not.toHaveProperty("user_id"); // RLS default fills the owner
    }
  });

  it("rewrites sample guide numbers in analysis sources and labels", () => {
    const a = analyses.find((x) => x.id === "AN-205")!;
    const out = remapGuideRefs(a, new Map([["G-1042", "G-1003"]]));
    const mine = out.sources.find((s) => s.kind === "my-guide")!;
    expect(mine.ref).toBe("G-1003");
    expect(mine.label.startsWith("G-1003")).toBe(true);
    expect(out.sources.filter((s) => s.kind !== "my-guide")).toEqual(a.sources.filter((s) => s.kind !== "my-guide"));
  });

  it("stores a schema-valid result for every analysis", () => {
    for (const a of analyses) {
      const row = analysisToRow(a, new Map());
      expect(analysisResultSchema.safeParse(row.result).success).toBe(true);
      expect(["High", "Medium", "Low"]).toContain(row.confidence);
    }
  });

  it("maps templates and release notes with allowed kinds", () => {
    for (const t of templates) expect(["Reply", "SQL", "Checklist"]).toContain(templateToRow(t).kind);
    for (const r of releaseNotes) expect(["Known issue", "Fix", "Note"]).toContain(releaseNoteToRow(r).type);
  });

  it("sample guide titles are unique (the seed matches rows back by title)", () => {
    expect(new Set(guides.map((g) => g.title)).size).toBe(guides.length);
  });
});
