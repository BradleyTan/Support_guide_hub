import { describe, expect, it } from "vitest";
import type { CheckedAnswer } from "@/lib/accountant/core/answer";
import { missingLines } from "../evals/match";

type L = [string, "asset" | "liability" | "income" | "expense", number | null, number | null];
function answer(...entries: L[][]): CheckedAnswer {
  return {
    answer: {
      needsMoreInfo: false,
      questions: [],
      summary: "",
      assumptions: [],
      entries: entries.map((lines) => ({ date: null, description: "", lines: lines.map(([account, accountType, dr, cr]) => ({ account, accountType, dr, cr })) })),
      steps: [],
      customerMessage: "",
      needsAccountant: null,
      doubts: [],
    },
    entryResults: [],
    steps: [],
    customerReply: null,
    sources: [],
    flags: [],
  };
}

describe("missingLines (live quality check)", () => {
  it("accepts a credit split across lines that add up to the expected amount", () => {
    const c = answer(
      [["Bank", "asset", 990, null], ["Customer", "asset", null, 990]],
      [["Bank charges", "expense", 10, null], ["Customer", "asset", null, 10]],
    );
    expect(missingLines(c, [{ type: "asset", side: "dr", amount: 990 }, { type: "expense", side: "dr", amount: 10 }, { type: "asset", side: "cr", amount: 1000 }])).toEqual([]);
  });

  it("still catches a refund booked to sales instead of the customer", () => {
    const c = answer(
      [["Bank", "asset", 2500, null], ["Customer", "asset", null, 2500]],
      [["Sales returns", "income", 500, null], ["Bank", "asset", null, 500]],
    );
    expect(missingLines(c, [{ type: "asset", side: "dr", amount: 2500 }, { type: "asset", side: "cr", amount: 2500 }, { type: "asset", side: "dr", amount: 500 }, { type: "asset", side: "cr", amount: 500 }])).toEqual([
      { type: "asset", side: "dr", amount: 500 },
    ]);
  });

  it("uses each answer line only once", () => {
    const c = answer([["Bank", "asset", 100, null], ["Sales", "income", null, 100]]);
    expect(missingLines(c, [{ type: "asset", side: "dr", amount: 100 }, { type: "asset", side: "dr", amount: 100 }])).toHaveLength(1);
  });
});
