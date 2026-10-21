import { describe, expect, it } from "vitest";
import { articleInputSchema, hasNewerVersion, missingStarters, type StarterArticle } from "@/lib/knowledge/model";

function starter(slug: string, version = 1): StarterArticle {
  return {
    slug,
    version,
    title: `Title ${slug}`,
    category: "Basics",
    tellCustomer: "A plain sentence.",
    whatItIs: "What it is.",
    example: "An example.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [],
    related: [],
    sources: [{ label: "Source", url: "https://example.com" }],
  };
}

const validInput = {
  title: "Debtor aging",
  category: "Customers (AR)",
  tellCustomer: "It shows who owes you money and for how long.",
  whatItIs: "",
  example: "",
  desktopSteps: null,
  cloudSteps: null,
  mistakes: [],
  related: [],
  sources: [{ label: "AutoCount help", url: "https://help.accounting.autocountcloud.com/support/solutions/articles/1-x" }],
};

describe("missingStarters", () => {
  it("missingStarters excludes binned slugs", () => {
    const all = [starter("a"), starter("b"), starter("c")];
    // "c" is in the bin: it still counts as existing, so it isn't offered again.
    expect(missingStarters(all, ["a", "c"]).map((s) => s.slug)).toEqual(["b"]);
  });

  it("offers everything when nothing exists yet", () => {
    expect(missingStarters([starter("a"), starter("b")], []).map((s) => s.slug)).toEqual(["a", "b"]);
  });
});

describe("hasNewerVersion", () => {
  const starters = [starter("debtor-aging", 2)];

  it("is true for an unedited copy of an older version", () => {
    expect(hasNewerVersion({ starterSlug: "debtor-aging", starterVersion: 1, edited: false }, starters)).toBe(true);
  });

  it("hasNewerVersion is false once edited", () => {
    expect(hasNewerVersion({ starterSlug: "debtor-aging", starterVersion: 1, edited: true }, starters)).toBe(false);
  });

  it("is false for the user's own articles", () => {
    expect(hasNewerVersion({ starterSlug: null, starterVersion: null, edited: false }, starters)).toBe(false);
  });

  it("is false when the versions match, or the starter no longer exists", () => {
    expect(hasNewerVersion({ starterSlug: "debtor-aging", starterVersion: 2, edited: false }, starters)).toBe(false);
    expect(hasNewerVersion({ starterSlug: "gone", starterVersion: 1, edited: false }, starters)).toBe(false);
  });
});

describe("articleInputSchema", () => {
  it("accepts a valid article", () => {
    expect(articleInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects http:// source links", () => {
    expect(articleInputSchema.safeParse({ ...validInput, sources: [{ label: "x", url: "http://example.com" }] }).success).toBe(false);
  });

  it("rejects an empty title and an unknown category", () => {
    expect(articleInputSchema.safeParse({ ...validInput, title: "  " }).success).toBe(false);
    expect(articleInputSchema.safeParse({ ...validInput, category: "Payroll" }).success).toBe(false);
  });

  it("turns empty AutoCount steps into null (not found)", () => {
    const parsed = articleInputSchema.parse({ ...validInput, desktopSteps: "  ", cloudSteps: "Sales > Invoice" });
    expect(parsed.desktopSteps).toBeNull();
    expect(parsed.cloudSteps).toBe("Sales > Invoice");
  });
});
