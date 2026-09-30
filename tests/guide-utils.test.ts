import { describe, expect, it } from "vitest";
import { countBy, journalTotals, mostUsed, recentlyUpdated, searchGuides, topTags, unverified } from "@/lib/guide-utils";
import { guides } from "@/lib/mock/guides";

describe("searchGuides", () => {
  it("ranks the SQL Server guide first for a pasted connection error", () => {
    const r = searchGuides(guides, "The server was not found or was not accessible SQL Server");
    expect(r[0].guide.id).toBe("G-1051");
  });

  it("ignores filler words so they don't create false matches", () => {
    expect(searchGuides(guides, "not found after the")).toEqual([]);
  });

  it("returns nothing for empty or whitespace input", () => {
    expect(searchGuides(guides, "")).toEqual([]);
    expect(searchGuides(guides, "   ")).toEqual([]);
  });

  it("matches tags written with hyphens", () => {
    expect(searchGuides(guides, "retained earnings")[0].guide.id).toBe("G-1043");
  });

  it("copes with special characters and very long input", () => {
    expect(() => searchGuides(guides, "%$#@!*(){}[]<>\\'\"`".repeat(500))).not.toThrow();
  });
});

describe("journalTotals", () => {
  it("detects a balanced entry", () => {
    const t = journalTotals({ date: "", description: "", lines: [{ account: "Bank", dr: 100 }, { account: "Sales", cr: 100 }] });
    expect(t).toEqual({ dr: 100, cr: 100, balanced: true });
  });

  it("detects an unbalanced entry", () => {
    expect(journalTotals({ date: "", description: "", lines: [{ account: "Bank", dr: 100 }, { account: "Sales", cr: 99.99 }] }).balanced).toBe(false);
  });

  it("is not fooled by floating-point rounding (0.1 + 0.2)", () => {
    const t = journalTotals({ date: "", description: "", lines: [{ account: "A", dr: 0.1 }, { account: "B", dr: 0.2 }, { account: "C", cr: 0.3 }] });
    expect(t.balanced).toBe(true);
  });
});

describe("list helpers", () => {
  it("countBy counts and sorts descending", () => {
    expect(countBy(["a", "b", "a"], (x) => x)).toEqual([
      { name: "a", count: 2 },
      { name: "b", count: 1 },
    ]);
  });

  it("mostUsed orders by uses", () => {
    const top = mostUsed(guides, 3);
    expect(top.map((g) => g.uses)).toEqual([...top.map((g) => g.uses)].sort((a, b) => b - a));
    expect(top[0].id).toBe("G-1051");
  });

  it("recentlyUpdated orders by updatedAt desc", () => {
    const r = recentlyUpdated(guides, 10);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].updatedAt >= r[i].updatedAt).toBe(true);
  });

  it("unverified returns only unverified guides", () => {
    expect(unverified(guides).every((g) => !g.verified)).toBe(true);
  });

  it("topTags limits the count", () => {
    expect(topTags(guides, 3)).toHaveLength(3);
  });
});
