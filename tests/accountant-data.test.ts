import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CheckedAnswer, ModelAnswer } from "@/lib/accountant/core/answer";
import { chatTitle, historyForGroq, rowToMessage, type ChatMessage } from "@/lib/accountant/chat";
import { answerToGuideInput } from "@/lib/accountant/to-guide";
import { guideInputSchema } from "@/lib/guide-schema";

const answer = (): ModelAnswer => JSON.parse(readFileSync("tests/fixtures/accountant/answer-ok.json", "utf8"));

function checked(over: Partial<CheckedAnswer> = {}): CheckedAnswer {
  const a = answer();
  return {
    answer: a,
    entryResults: [{ balanced: true, problem: null }],
    steps: [
      { ...a.steps[0], status: "confirmed" },
      { ...a.steps[1], status: "not-confirmed" },
    ],
    customerReply: "Reply",
    sources: [],
    flags: [],
    ...over,
  };
}

describe("answerToGuideInput", () => {
  const scenario = "Customer paid RM990 for a RM1,000 invoice; the bank took RM10.";

  it("only confirmed steps become guide steps", () => {
    const g = answerToGuideInput(checked(), scenario);
    expect(g.steps).toEqual(["Create a receipt for RM990 and knock off the invoice. (Sales > Receive Payment)"]);
    expect(g.symptom).toBe(scenario);
    expect(g.tags).toEqual(["accountant-chat"]);
    expect(g.cause).toContain("Journal: Dr Bank RM990.00 / Dr Bank charges RM10.00 / Cr Trade debtor - [COMPANY 1] RM1,000.00");
    expect(g.title!.length).toBeLessThanOrEqual(300);
  });

  it("platform both when steps for both", () => {
    const both = checked({ steps: checked().steps.map((s) => ({ ...s, status: "confirmed" as const })) });
    expect(answerToGuideInput(both, scenario).platform).toBe("both");
    expect(answerToGuideInput(checked(), scenario).platform).toBe("cloud");
  });

  it("leaves out unbalanced entries and still gives a form the guide schema accepts once a product is picked", () => {
    const g = answerToGuideInput(checked({ entryResults: [{ balanced: false, problem: "x" }] }), scenario);
    expect(g.cause).not.toContain("Journal:");
    expect(guideInputSchema.safeParse({ ...g, product: "AutoCount Accounting" }).success).toBe(true);
  });

  it("falls back to the scenario text as a step when nothing is confirmed", () => {
    const g = answerToGuideInput(checked({ steps: [] }), scenario);
    expect(g.steps!.length).toBeGreaterThan(0);
  });
});

describe("chat helpers", () => {
  it("chatTitle is one line, at most 80 characters", () => {
    expect(chatTitle("  Old deposit\nnever recorded  ")).toBe("Old deposit never recorded");
    expect(chatTitle("x".repeat(200))).toHaveLength(80);
    expect(chatTitle("   ")).toBe("New chat");
  });

  it("rowToMessage keeps a well-formed answer and drops a broken one", () => {
    const base = { id: "m1", role: "assistant", content: "", checked: false, created_at: "2026-10-22T00:00:00Z" };
    expect(rowToMessage({ ...base, answer: checked() as never }).answer?.customerReply).toBe("Reply");
    expect(rowToMessage({ ...base, answer: { nonsense: true } }).answer).toBeNull();
  });

  it("historyForGroq sends the last 6 turns, with answers as short text", () => {
    const msgs: ChatMessage[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      role: i % 2 ? "assistant" : "user",
      content: i % 2 ? "" : `question ${i}`,
      answer: i % 2 ? checked() : null,
      checked: false,
      createdAt: "",
    }));
    const h = historyForGroq(msgs);
    expect(h).toHaveLength(6);
    expect(h[0]).toEqual({ role: "user", content: "question 2" });
    expect(h[1].role).toBe("assistant");
    expect(h[1].content).toContain(answer().summary);
  });
});
