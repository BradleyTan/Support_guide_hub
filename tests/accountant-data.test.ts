import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CheckedAnswer, ModelAnswer } from "@/lib/accountant/core/answer";
import { askErrorMessage, chatTitle, historyForGroq, rowToMessage, turnRows, unmaskAnswer, type ChatMessage } from "@/lib/accountant/chat";
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

  it("a step whose path was never checked keeps its text but not the path", () => {
    const steps = [{ platform: "desktop" as const, text: "Open A/R > Made Up Screen and knock off the invoice.", menuPath: null, sourceIds: [], status: "no-path" as const }];
    const g = answerToGuideInput(checked({ steps }), "x");
    expect(g.steps!.join(" ")).not.toContain("Made Up Screen");
  });

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

describe("askErrorMessage", () => {
  it("gives the fixed rate-limit wording with the wait time", () => {
    expect(askErrorMessage(429, { error: "rate_limited", retryAfter: 42 })).toBe("Groq's free limit is busy — try again in 42 seconds");
    expect(askErrorMessage(429, null)).toBe("Groq's free limit is busy — try again in 60 seconds");
  });

  it("explains a missing key, a garbled answer, signing in and anything else", () => {
    expect(askErrorMessage(503, { error: "not_configured" })).toMatch(/GROQ_API_KEY/);
    expect(askErrorMessage(502, { error: "bad_answer" })).toMatch(/try again/i);
    expect(askErrorMessage(401, {})).toMatch(/sign in/i);
    expect(askErrorMessage(500, "x")).toMatch(/try again/i);
    expect(askErrorMessage(400, { error: "mask_too_large" })).toMatch(/new chat/i);
  });
});

describe("unmaskAnswer", () => {
  it("puts real names back everywhere, including values with quotes", () => {
    const map = { "[COMPANY 1]": 'Lee "Best" Trading Sdn Bhd' };
    const out = unmaskAnswer(checked({ customerReply: "Hi [COMPANY 1]" }), map);
    expect(out.customerReply).toBe('Hi Lee "Best" Trading Sdn Bhd');
    expect(out.answer.entries[0].lines[2].account).toBe('Trade debtor - Lee "Best" Trading Sdn Bhd');
    expect(out.entryResults).toEqual([{ balanced: true, problem: null }]);
  });
});

describe("turnRows", () => {
  it("gives both rows the same columns, so a two-row insert never sends a missing column as null", () => {
    const rows = turnRows("00000000-0000-4000-8000-000000000001", "Question?", checked());
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(rows[1]).sort());
    for (const r of rows) for (const v of Object.values(r)) expect(v).not.toBeUndefined();
    expect(rows[0]).toMatchObject({ role: "user", content: "Question?", answer: null });
    expect(rows[1]).toMatchObject({ role: "assistant", content: "" });
    expect(rows[1].answer).not.toBeNull();
  });
});
