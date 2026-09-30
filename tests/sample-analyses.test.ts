import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "@/lib/analysis-schema";
import { journalTotals } from "@/lib/guide-utils";
import { analyses } from "@/lib/mock/analyses";

describe("sample accounting analyses", () => {
  for (const a of analyses) {
    describe(a.title, () => {
      it("matches the 7-section result schema", () => {
        expect(analysisResultSchema.safeParse(a).success).toBe(true);
      });

      it("has journal entries where total Dr equals total Cr", () => {
        for (const e of a.entries) expect(journalTotals(e), e.description).toMatchObject({ balanced: true });
      });

      it("never presents an unverified AutoCount menu path as fact", () => {
        for (const s of a.steps) {
          if (!s.verified) expect(a.needsVerification.join(" ").toLowerCase()).toMatch(/menu path|path/);
        }
      });

      it("states a confidence level and at least one source or general-knowledge label", () => {
        expect(["High", "Medium", "Low"]).toContain(a.confidence);
        expect(a.sources.length + a.needsVerification.length).toBeGreaterThan(0);
      });
    });
  }

  it("USD deposit → SST invoice → partial payment leaves USD 2,400 at RM 10,440 after revaluation", () => {
    const a = analyses.find((x) => x.id === "AN-205")!;
    const debtor = a.entries.flatMap((e) => e.lines).filter((l) => l.account === "Trade debtor");
    const balance = debtor.reduce((s, l) => s + (l.dr ?? 0) - (l.cr ?? 0), 0);
    expect(Math.round(balance * 100) / 100).toBe(10440); // 2,400 × 4.35
  });
});
