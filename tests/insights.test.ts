import { describe, expect, it } from "vitest";
import { activityTotals, isIncomplete, isStale, libraryHealth, newGuideHref, notOpenedRecently, weekLabel, type WeekActivity } from "@/lib/insights";
import { guides as sample } from "@/lib/mock/guides";
import type { Guide } from "@/lib/types";

const NOW = new Date("2026-10-01T12:00:00+08:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function guide(over: Partial<Guide>): Guide {
  return { ...sample[0], id: "G-9000", dbId: "db-9000", cause: "A cause", steps: ["Do this"], verified: true, createdAt: daysAgo(100), updatedAt: daysAgo(10), ...over };
}

describe("isIncomplete", () => {
  it("needs both a cause and at least one non-blank fix step", () => {
    expect(isIncomplete(guide({}))).toBe(false);
    expect(isIncomplete(guide({ cause: undefined }))).toBe(true);
    expect(isIncomplete(guide({ cause: "   " }))).toBe(true);
    expect(isIncomplete(guide({ steps: [] }))).toBe(true);
    expect(isIncomplete(guide({ steps: ["  "] }))).toBe(true);
  });
});

describe("isStale", () => {
  it("flags guides not edited for more than 365 days", () => {
    expect(isStale(guide({ updatedAt: daysAgo(365) }), NOW)).toBe(false);
    expect(isStale(guide({ updatedAt: daysAgo(366) }), NOW)).toBe(true);
  });
});

describe("libraryHealth", () => {
  it("counts per product, including products with no guides, and lists problems oldest first", () => {
    const list = [
      guide({ id: "G-1", product: "AutoCount Payroll", verified: false, updatedAt: daysAgo(5) }),
      guide({ id: "G-2", product: "AutoCount Payroll", verified: false, updatedAt: daysAgo(50) }),
      guide({ id: "G-3", product: "AutoCount Accounting", cause: undefined, updatedAt: daysAgo(400) }),
    ];
    const h = libraryHealth(list, NOW);
    expect(h.total).toBe(3);
    expect(h.verified).toBe(1);
    expect(h.unverified.map((g) => g.id)).toEqual(["G-2", "G-1"]);
    expect(h.incomplete.map((g) => g.id)).toEqual(["G-3"]);
    expect(h.stale.map((g) => g.id)).toEqual(["G-3"]);
    expect(h.byProduct).toEqual([
      { product: "AutoCount Accounting", count: 1, verified: 1 },
      { product: "AutoCount Payroll", count: 2, verified: 0 },
      { product: "AutoCount POS", count: 0, verified: 0 },
      { product: "AutoCount Account Book", count: 0, verified: 0 },
    ]);
  });

  it("handles an empty library", () => {
    const h = libraryHealth([], NOW);
    expect(h.total).toBe(0);
    expect(h.byProduct.every((p) => p.count === 0)).toBe(true);
  });
});

describe("notOpenedRecently", () => {
  it("leaves out opened guides and guides added in the last 30 days", () => {
    const list = [
      guide({ id: "G-opened", dbId: "a" }),
      guide({ id: "G-new", dbId: "b", createdAt: daysAgo(10) }),
      guide({ id: "G-old", dbId: "c", updatedAt: daysAgo(200) }),
      guide({ id: "G-older", dbId: "d", updatedAt: daysAgo(300) }),
    ];
    expect(notOpenedRecently(list, new Set(["a"]), NOW).map((g) => g.id)).toEqual(["G-older", "G-old"]);
  });
});

describe("activityTotals", () => {
  const week = (over: Partial<WeekActivity>): WeekActivity => ({ weekStart: "2026-09-28", opens: 0, searches: 0, unmatched: 0, added: 0, edited: 0, ...over });

  it("sums the weeks and works out the share of searches that found no guide", () => {
    const t = activityTotals([week({ opens: 3, searches: 4, unmatched: 1, added: 1 }), week({ opens: 2, searches: 2, unmatched: 1, edited: 5 })]);
    expect(t).toEqual({ opens: 5, searches: 6, unmatched: 2, unmatchedPct: 33, added: 1, edited: 5 });
  });

  it("has no percentage when there were no searches", () => {
    expect(activityTotals([week({ opens: 2 })]).unmatchedPct).toBeNull();
    expect(activityTotals([]).unmatchedPct).toBeNull();
  });
});

describe("weekLabel", () => {
  it("shows the Monday as day and short month, whatever the computer's time zone", () => {
    expect(weekLabel("2026-09-28")).toBe("28 Sept");
    expect(weekLabel("2026-01-05")).toBe("5 Jan");
  });
});

describe("newGuideHref", () => {
  it("prefills the title, trimmed and URL-encoded", () => {
    expect(newGuideHref("  e-Invoice TIN & SST  ")).toBe("/guides/new?title=e-Invoice%20TIN%20%26%20SST");
    expect(decodeURIComponent(newGuideHref("x".repeat(400)).split("=")[1])).toHaveLength(300);
  });
});
