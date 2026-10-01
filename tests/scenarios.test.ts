import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "@/lib/analysis-schema";
import { journalTotals } from "@/lib/guide-utils";
import { defaultValues, getScenario, runScenario, SCENARIOS, type Field, type Values } from "@/lib/scenarios";
import { roundToFiveSen } from "@/lib/scenarios/money";
import type { JournalEntry } from "@/lib/types";

/** Entries as [account, dr, cr] rows, to compare with hand-worked figures. */
function rows(entries: JournalEntry[]) {
  return entries.map((e) => e.lines.map((l) => [l.account, l.dr ?? 0, l.cr ?? 0]));
}

function run(id: string, overrides: Values = {}) {
  const s = getScenario(id)!;
  return runScenario(s, { ...defaultValues(s), ...overrides });
}

function ok(id: string, overrides: Values = {}) {
  const r = run(id, overrides);
  if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.errors)}`);
  return r.output;
}

describe("scenario library", () => {
  it("has at least 20 scenarios with unique ids", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  for (const s of SCENARIOS) {
    it(`${s.id}: default inputs give a valid, balanced result`, () => {
      const out = ok(s.id);
      expect(analysisResultSchema.safeParse(out.result).success).toBe(true);
      expect(out.result.entries.length).toBeGreaterThan(0);
      for (const e of out.result.entries) expect(journalTotals(e).balanced, e.description).toBe(true);
      // Never present an AutoCount menu path as confirmed
      for (const st of out.result.steps) expect(st.verified).toBe(false);
      expect(out.result.needsVerification.join(" ")).toMatch(/menu path/);
    });
  }
});

/** Small deterministic random generator so failures are reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function randomValue(f: Field, r: () => number): number | string {
  switch (f.kind) {
    case "money":
    case "foreign":
      return Math.round(r() * (r() < 0.1 ? 1e9 : 1e6) * 100) / 100;
    case "rate":
      return Math.round((0.01 + r() * 10) * 10000) / 10000;
    case "percent":
      return Math.round(r() * 100);
    case "number":
      return Math.floor(r() * Math.min(f.max ?? 100, 120));
    case "choice":
      return f.options![Math.floor(r() * f.options!.length)].value;
    default:
      return f.default;
  }
}

describe("stress test: any valid inputs either balance or explain the problem", () => {
  for (const s of SCENARIOS) {
    it(s.id, () => {
      const r = rng(s.id.length * 7919);
      for (let i = 0; i < 300; i++) {
        const values = Object.fromEntries(s.fields.map((f) => [f.key, randomValue(f, r)]));
        const res = runScenario(s, values);
        if (res.ok) {
          for (const e of res.output.result.entries) {
            const t = journalTotals(e);
            expect(t.balanced, `${s.id} ${JSON.stringify(values)} ${e.description}`).toBe(true);
            for (const l of e.lines) expect((l.dr ?? 0) >= 0 && (l.cr ?? 0) >= 0).toBe(true);
          }
        } else {
          expect(Object.values(res.errors).every((m) => typeof m === "string" && m.length > 0)).toBe(true);
          expect(res.errors._, `${s.id} crashed on ${JSON.stringify(values)}`).toBeUndefined();
        }
      }
    });
  }
});

describe("hand-checked results", () => {
  it("USD deposit → SST invoice → partial payment → revaluation", () => {
    expect(rows(ok("usd-deposit-sst-partial").result.entries)).toEqual([
      [
        ["Bank – USD", 4450, 0],
        ["Customer deposit (liability)", 0, 4450],
      ],
      [
        ["Trade debtor", 23760, 0],
        ["Service revenue", 0, 22000],
        ["Service tax payable", 0, 1760],
      ],
      [
        ["Customer deposit (liability)", 4450, 0],
        ["Trade debtor", 0, 4400],
        ["Realised exchange gain", 0, 50],
      ],
      [
        ["Bank – USD", 8760, 0],
        ["Trade debtor", 0, 8800],
        ["Realised exchange loss", 40, 0],
      ],
      [
        ["Unrealised exchange loss", 120, 0],
        ["Trade debtor", 0, 120],
      ],
    ]);
  });

  it("debtor balance after the USD cycle equals USD 2,400 × 4.35", () => {
    const debtor = ok("usd-deposit-sst-partial")
      .result.entries.flatMap((e) => e.lines)
      .filter((l) => l.account === "Trade debtor")
      .reduce((s, l) => s + (l.dr ?? 0) - (l.cr ?? 0), 0);
    expect(Math.round(debtor * 100) / 100).toBe(10440);
  });

  it("service tax 8% on RM 20,000", () => {
    expect(rows(ok("service-tax-invoice").result.entries)).toEqual([
      [
        ["Trade debtor", 21600, 0],
        ["Service revenue", 0, 20000],
        ["Service tax payable", 0, 1600],
      ],
    ]);
  });

  it("overpayment with bank charges: excess held as a deposit", () => {
    expect(rows(ok("partial-payment", { invoice: 1000, received: 1200, charges: 10 }).result.entries)).toEqual([
      [
        ["Bank", 1190, 0],
        ["Bank charges", 10, 0],
        ["Trade debtor", 0, 1000],
        ["Customer deposit (liability)", 0, 200],
      ],
    ]);
  });

  it("payroll: net pay and employer cost", () => {
    const [e] = ok("payroll-journal").result.entries;
    const net = e.lines.find((l) => l.account === "Salaries payable (net pay)")!.cr;
    expect(net).toBe(4295.35); // 5,000 − 550 − 24.75 − 9.90 − 120
    expect(journalTotals(e).dr).toBeCloseTo(5796.55, 2); // 5,000 + 650 + 86.65 + 9.90 + 50
  });

  it("depreciation: RM 6,000 over 3 years, 1 month = RM 166.67", () => {
    expect(rows(ok("depreciation").result.entries)).toEqual([
      [
        ["Depreciation expense", 166.67, 0],
        ["Accumulated depreciation", 0, 166.67],
      ],
    ]);
  });

  it("prepayment: 3 of 12 months of RM 2,400 = RM 600", () => {
    expect(rows(ok("prepayment").result.entries)[1]).toEqual([
      ["Insurance", 600, 0],
      ["Prepaid insurance", 0, 600],
    ]);
  });

  it("foreign payable rising in RM is a loss", () => {
    expect(rows(ok("fx-revaluation", { side: "creditor", amount: 1000, bookRate: 4.3, closeRate: 4.4 }).result.entries)).toEqual([
      [
        ["Unrealised exchange loss", 100, 0],
        ["Trade creditor", 0, 100],
      ],
    ]);
  });

  it("cash rounding to the nearest 5 sen", () => {
    expect(roundToFiveSen(1097)).toBe(1095);
    expect(roundToFiveSen(1098)).toBe(1100);
    expect(roundToFiveSen(1093)).toBe(1095);
    expect(roundToFiveSen(1092)).toBe(1090);
    expect(rows(ok("cash-rounding").result.entries)).toEqual([
      [
        ["Cash", 10.95, 0],
        ["Rounding adjustment", 0.02, 0],
        ["Sales", 0, 10.97],
      ],
    ]);
  });

  it("contra can't exceed either balance", () => {
    const r = run("contra", { amount: 9000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amount).toMatch(/can't be more/);
  });

  it("rejects bad inputs with field messages", () => {
    const r = run("service-tax-invoice", { rate: 120, net: -5 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.rate).toMatch(/100/);
      expect(r.errors.net).toMatch(/negative/);
    }
    const d = run("service-tax-invoice", { net: 10.005 });
    expect(d.ok).toBe(false);
  });
});

/** The approval document: default inputs and the entries they produce, for every scenario. */
function approvalDocument() {
  const lines = [
    "# Accounting scenarios: approved expected results",
    "",
    "Generated from the scenario calculator's default inputs. **All entries approved by the user on 1 Oct 2026.** The tests lock these figures: any change to the calculations makes the tests fail until this file is deliberately updated (`npx vitest run -u`), and a changed entry needs approving again.",
    "",
    "Amounts in RM. AutoCount menu paths are not confirmed and are always marked “needs verification” in the app.",
    "",
  ];
  for (const s of SCENARIOS) {
    const out = ok(s.id);
    lines.push(`## ${s.title}`, "", `*${s.category} · \`${s.id}\`*`, "", `**Inputs:** ${out.narrative}`, "");
    for (const e of out.result.entries) {
      lines.push(`**${e.date} — ${e.description}**`, "", "| Account | Dr | Cr |", "|---|--:|--:|");
      for (const l of e.lines) lines.push(`| ${l.account} | ${l.dr?.toFixed(2) ?? ""} | ${l.cr?.toFixed(2) ?? ""} |`);
      const t = journalTotals(e);
      lines.push(`| **Total** | **${t.dr.toFixed(2)}** | **${t.cr.toFixed(2)}** |`, "");
    }
    if (out.result.judgementNote) lines.push(`> Judgement: ${out.result.judgementNote}`, "");
    lines.push("- [x] Approved", "");
  }
  return lines.join("\n");
}

describe("approval document", () => {
  it("matches docs/accounting-scenarios.md", async () => {
    await expect(approvalDocument()).toMatchFileSnapshot("../docs/accounting-scenarios.md");
  });
});
