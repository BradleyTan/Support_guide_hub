import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ModelAnswer, ModelStep, Source } from "@/lib/accountant/core/answer";
import { buildCustomerReply, checkAnswer, checkEntry, checkStep, normalizePath } from "@/lib/accountant/core/checks";

const fixture = (): ModelAnswer => JSON.parse(readFileSync("tests/fixtures/accountant/answer-ok.json", "utf8"));

function src(over: Partial<Source>): Source {
  return { id: "S1", kind: "official", title: "Help", url: "https://help.accounting.autocountcloud.com/support/solutions/articles/1-x", platform: "cloud", checked: true, text: "", ...over };
}
const step = (over: Partial<ModelStep>): ModelStep => ({ platform: "cloud", text: "Do it", menuPath: "Sales > Invoice", sourceIds: ["S1"], ...over });

describe("checkEntry", () => {
  const e = (lines: [number | null, number | null][]) => ({
    date: null,
    description: "x",
    lines: lines.map(([dr, cr], i) => ({ account: `A${i}`, accountType: "asset" as const, dr, cr })),
  });

  it("balances in sen not floats", () => {
    expect(checkEntry(e([[0.1, null], [0.2, null], [null, 0.3]])).balanced).toBe(true);
  });

  it("flags unbalanced", () => {
    const r = checkEntry(e([[100, null], [null, 90]]));
    expect(r.balanced).toBe(false);
    expect(r.problem).toContain("10.00");
  });

  it("rejects a line with both dr and cr", () => {
    expect(checkEntry(e([[100, 100], [null, 0]])).balanced).toBe(false);
  });

  it("rejects zero or negative amounts", () => {
    expect(checkEntry(e([[0, null], [null, 0]])).balanced).toBe(false);
    expect(checkEntry(e([[-50, null], [null, -50]])).balanced).toBe(false);
  });
});

describe("checkStep", () => {
  it("path matching ignores case, spacing and arrows", () => {
    expect(normalizePath("Sales  →  Invoice")).toBe(normalizePath("sales > invoice"));
    expect(checkStep(step({ menuPath: "Sales → Invoice" }), [src({ text: "First go to sales > invoice, then click New." })]).status).toBe("confirmed");
  });

  it("cloud source never confirms a desktop path", () => {
    expect(checkStep(step({ platform: "desktop" }), [src({ text: "Sales > Invoice" })]).status).toBe("not-confirmed");
    const desktopGuide = src({ kind: "my-guide", platform: "desktop", text: "Sales > Invoice" });
    expect(checkStep(step({ platform: "cloud" }), [desktopGuide]).status).toBe("not-confirmed");
  });

  it("both-platform verified guide confirms desktop", () => {
    expect(checkStep(step({ platform: "desktop" }), [src({ kind: "my-guide", platform: "both", text: "Sales > Invoice" })]).status).toBe("confirmed");
  });

  it("unverified guide gives unverified-source", () => {
    expect(checkStep(step({ platform: "desktop" }), [src({ kind: "my-guide", platform: "desktop", checked: false, text: "Sales > Invoice" })]).status).toBe("unverified-source");
  });

  it("web source never confirms", () => {
    expect(checkStep(step({}), [src({ kind: "web", platform: null, text: "Sales > Invoice" })]).status).toBe("not-confirmed");
  });

  it("only cited sources count", () => {
    expect(checkStep(step({ sourceIds: ["S2"] }), [src({ text: "Sales > Invoice" })]).status).toBe("not-confirmed");
  });

  it("a step without a menu path is not called confirmed", () => {
    expect(checkStep(step({ menuPath: null, sourceIds: [] }), []).status).toBe("no-path");
  });

  it("a path that is only the start of a longer menu is not confirmed", () => {
    expect(checkStep(step({ menuPath: "Sales > Invoice" }), [src({ text: "Go to Sales > Invoice Listing." })]).status).toBe("not-confirmed");
    expect(checkStep(step({ menuPath: "Sales > Invoice" }), [src({ text: "Go to Sales > Invoice." })]).status).toBe("confirmed");
  });

  it("a one-word path is never confirmed", () => {
    expect(checkStep(step({ menuPath: "Sales" }), [src({ text: "Sales" })]).status).toBe("not-confirmed");
  });

  it("a path is not matched inside a longer word", () => {
    expect(checkStep(step({ menuPath: "Sales > Invoice" }), [src({ text: "Presales > Invoice." })]).status).toBe("not-confirmed");
  });
});

describe("buildCustomerReply", () => {
  const map = { "[COMPANY 1]": "Lee Trading Sdn Bhd" };

  it("customer reply replaces unconfirmed path with fixed sentence", () => {
    const a = fixture();
    const steps = [
      { ...a.steps[0], status: "confirmed" as const },
      { ...a.steps[1], status: "not-confirmed" as const },
    ];
    const { reply } = buildCustomerReply(a, steps, [{ balanced: true }], map);
    expect(reply).toContain("Sales > Receive Payment");
    expect(reply).not.toContain("A/R > A/R Payment");
    expect(reply).toContain("I'll confirm the exact menu and get back to you.");
    expect(reply).toContain("AutoCount Cloud:");
    expect(reply).toContain("AutoCount (Desktop):");
  });

  it("a path written in the step text never reaches the customer unchecked", () => {
    const a = fixture();
    const steps = [{ platform: "desktop" as const, text: "Open A/R > Made Up Screen > Knock Off and save.", menuPath: null, sourceIds: [], status: "no-path" as const }];
    const { reply } = buildCustomerReply(a, steps, [{ balanced: true }], map);
    expect(reply).not.toContain("Made Up Screen");
    expect(reply).toContain("I'll confirm the exact menu and get back to you.");
  });

  it("a confirmed step keeps only its checked path, not other paths in its text", () => {
    const a = fixture();
    const steps = [{ platform: "desktop" as const, text: "Use Sales > Cloud Only Screen first.", menuPath: "A/R > A/R Payment", sourceIds: ["S1"], status: "confirmed" as const }];
    const { reply } = buildCustomerReply(a, steps, [{ balanced: true }], map);
    expect(reply).not.toContain("Cloud Only Screen");
    expect(reply).toContain("A/R > A/R Payment");
  });

  it("paths with any separator are kept out of the customer reply", () => {
    for (const path of ["Sales -> Fake Menu", "Sales » Fake Menu", "Sales › Fake Menu", "Sales>Fake Menu", "Sales → Fake Menu"]) {
      const a = { ...fixture(), customerMessage: `We'll sort it out. Open ${path} to check.` };
      const steps = [{ platform: "cloud" as const, text: `Open ${path}.`, menuPath: null, sourceIds: [], status: "no-path" as const }];
      const { reply } = buildCustomerReply(a, steps, [{ balanced: true }], map);
      expect(reply, path).not.toContain("Fake Menu");
    }
  });

  it("customer reply omits unbalanced entries", () => {
    const a = fixture();
    const { reply } = buildCustomerReply(a, [], [{ balanced: false }], map);
    expect(reply).not.toContain("Bank charges");
  });

  it("includes balanced entries as Dr/Cr lines", () => {
    const { reply } = buildCustomerReply(fixture(), [], [{ balanced: true }], map);
    expect(reply).toContain("Dr Bank RM990.00");
    expect(reply).toContain("Cr Trade debtor - [COMPANY 1] RM1,000.00");
  });

  it("drops menu-path sentences from the customer message", () => {
    const a = { ...fixture(), customerMessage: "We'll fix it. Go to Sales > Invoice to see it. Thanks." };
    const { reply, flags } = buildCustomerReply(a, [], [{ balanced: true }], map);
    expect(reply).not.toContain("Sales > Invoice");
    expect(reply).toContain("We'll fix it.");
    expect(flags.length).toBeGreaterThan(0);
  });

  it("customer reply with unknown placeholder is flagged", () => {
    for (const bad of ["[COMPANY 9]", "[company 1]", "[Company 1]"]) {
      const a = { ...fixture(), customerMessage: `Hi ${bad}, here is the fix.` };
      const r = buildCustomerReply(a, [], [{ balanced: true }], map);
      expect(r.reply, bad).toBeNull();
      expect(r.flags).toContain("Customer reply had unknown placeholders");
    }
  });

  it("needsMoreInfo gives null reply", () => {
    const a = { ...fixture(), needsMoreInfo: true, questions: ["Where did the money go?"] };
    expect(buildCustomerReply(a, [], [], map).reply).toBeNull();
  });
});

describe("checkAnswer", () => {
  it("returns sources without their text and keeps step statuses", () => {
    const sources = [src({ id: "S1", text: "Sales > Receive Payment" }), src({ id: "S2", kind: "my-guide", platform: "desktop", checked: true, text: "A/R > A/R Payment" })];
    const r = checkAnswer(fixture(), sources, { "[COMPANY 1]": "X Sdn Bhd" });
    expect(r.steps.map((s) => s.status)).toEqual(["confirmed", "confirmed"]);
    expect(r.entryResults).toEqual([{ balanced: true, problem: null }]);
    expect(r.sources.every((s) => !("text" in s))).toBe(true);
    expect(r.customerReply).toContain("A/R > A/R Payment");
  });

  it("questions-only answers drop entries and steps", () => {
    const a = { ...fixture(), needsMoreInfo: true, questions: ["Was the year audited?"] };
    const r = checkAnswer(a, [], {});
    expect(r.customerReply).toBeNull();
    expect(r.answer.entries).toEqual([]);
    expect(r.steps).toEqual([]);
  });
});

describe("minor fixes from the final review", () => {
  it("an absurdly large amount never counts as balanced", () => {
    const e = { date: null, description: "x", lines: [
      { account: "A", accountType: "asset" as const, dr: 1e308, cr: null },
      { account: "B", accountType: "asset" as const, dr: null, cr: 1e308 },
    ] };
    expect(checkEntry(e).balanced).toBe(false);
  });

  it("the customer reply may only use names from this customer's own scenario", () => {
    const map = { "[COMPANY 1]": "This Customer Sdn Bhd", "[COMPANY 2]": "Other Customer Sdn Bhd" };
    const a = { ...fixture(), customerMessage: "Hi [COMPANY 2], here is the fix." };
    const r = checkAnswer(a, [], map, ["[COMPANY 1]"]);
    expect(r.customerReply).toBeNull();
    expect(r.flags).toContain("Customer reply had unknown placeholders");
    expect(checkAnswer({ ...fixture(), customerMessage: "Hi [COMPANY 1]." }, [], map, ["[COMPANY 1]"]).customerReply).toContain("[COMPANY 1]");
  });
});
