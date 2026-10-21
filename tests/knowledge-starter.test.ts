import { describe, expect, it } from "vitest";
import { articleInputSchema, KNOWLEDGE_CATEGORIES } from "@/lib/knowledge/model";
import { STARTER_ARTICLES } from "@/lib/knowledge/starter";

/** The spec's topic list (docs/superpowers/specs/2026-10-21-knowledge-hub-design.md), as slugs per category. */
const TOPICS: Record<(typeof KNOWLEDGE_CATEGORIES)[number], string[]> = {
  Basics: ["debit-and-credit", "chart-of-accounts", "journal-entry", "financial-year-and-periods", "opening-balance", "year-end-closing"],
  "Customers (AR)": ["invoice-vs-cash-sale", "credit-note-and-debit-note", "receiving-payment-and-knock-off", "ar-deposit", "contra", "debtor-statement", "debtor-aging"],
  "Suppliers (AP)": ["purchase-invoice", "supplier-payment", "supplier-deposit", "creditor-aging"],
  "Bank & cash": ["bank-reconciliation", "petty-cash", "post-dated-cheques"],
  Stock: ["stock-costing-methods", "stock-take-and-adjustment", "stock-valuation"],
  Reports: ["trial-balance", "profit-and-loss", "balance-sheet", "general-ledger", "cash-flow-statement"],
  Tax: ["sst", "e-invoice-and-tin", "withholding-tax"],
  "Period-end": ["accruals-and-prepayments", "depreciation", "bad-debts", "foreign-currency-gain-loss", "locking-past-periods"],
};

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim()).length;

describe("starter articles", () => {
  it("includes every topic in every category", () => {
    const slugs = new Set(STARTER_ARTICLES.map((a) => a.slug));
    for (const cat of KNOWLEDGE_CATEGORIES) for (const slug of TOPICS[cat]) expect(slugs.has(slug), slug).toBe(true);
    expect(STARTER_ARTICLES.length).toBeGreaterThanOrEqual(36);
  });

  it("covers every topic of each category it includes", () => {
    const slugs = new Set(STARTER_ARTICLES.map((a) => a.slug));
    const present = new Set(STARTER_ARTICLES.map((a) => a.category));
    for (const cat of present) for (const slug of TOPICS[cat]) expect(slugs.has(slug), `${cat}: ${slug}`).toBe(true);
    for (const a of STARTER_ARTICLES) expect(TOPICS[a.category], a.slug).toContain(a.slug);
  });

  it("has unique kebab-case slugs and versions from 1", () => {
    const slugs = STARTER_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of STARTER_ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(a.version).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(STARTER_ARTICLES.map((a) => [a.slug, a] as const))("%s is valid and complete", (_slug, a) => {
    expect(articleInputSchema.safeParse(a).success).toBe(true);
    // Something you can say to a client straight away: short, at most three sentences.
    expect(a.tellCustomer.length).toBeLessThanOrEqual(400);
    expect(sentences(a.tellCustomer)).toBeLessThanOrEqual(3);
    for (const field of [a.title, a.whatItIs, a.example]) expect(field.trim().length).toBeGreaterThan(0);
    expect(a.mistakes.length).toBeGreaterThan(0);
    // Sources: at least one, https only, never the help centres' disallowed search pages.
    expect(a.sources.length).toBeGreaterThan(0);
    for (const s of a.sources) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(s.url).not.toContain("/support/search");
    }
    // A Cloud path is never passed off as the Desktop path.
    if (a.desktopSteps && a.cloudSteps) expect(a.desktopSteps).not.toBe(a.cloudSteps);
    if (a.category === "Tax") expect(a.whatItIs + a.example + a.tellCustomer).toMatch(/as of/i);
  });

  it("makes no claim about desktop AutoCount without a desktop menu path to back it", () => {
    // The readable sources are the Cloud help centre; desktop features are only described once the user adds a path.
    for (const a of STARTER_ARTICLES.filter((x) => !x.desktopSteps)) {
      const text = `${a.tellCustomer} ${a.whatItIs} ${a.example}`;
      expect(text, a.slug).not.toMatch(/desktop AutoCount[^.]*(has|have|uses?|supports?)|some editions have/i);
    }
  });

  it("links only to starter articles that exist, and never to itself", () => {
    const slugs = new Set(STARTER_ARTICLES.map((a) => a.slug));
    for (const a of STARTER_ARTICLES) {
      for (const r of a.related) expect(slugs.has(r), `${a.slug} → ${r}`).toBe(true);
      expect(a.related).not.toContain(a.slug);
    }
  });
});
