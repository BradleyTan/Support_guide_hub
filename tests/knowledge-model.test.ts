import { describe, expect, it } from "vitest";
import { articleInputSchema, hasNewerVersion, missingStarters, rowToArticle, starterToRow, stepsChanged, type StarterArticle } from "@/lib/knowledge/model";

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

describe("row mapping", () => {
  const s = { ...starter("debtor-aging", 3), category: "Customers (AR)" as const, desktopSteps: "Reports > Debtor Aging", mistakes: ["Wrong date"], related: ["debtor-statement"] };

  it("starterToRow copies every content field and marks a fresh, unreviewed copy", () => {
    expect(starterToRow(s)).toEqual({
      starter_slug: "debtor-aging",
      starter_version: 3,
      edited: false,
      reviewed: false,
      steps_verified: false,
      title: s.title,
      category: "Customers (AR)",
      tell_customer: s.tellCustomer,
      what_it_is: s.whatItIs,
      example: s.example,
      desktop_steps: "Reports > Debtor Aging",
      cloud_steps: null,
      mistakes: ["Wrong date"],
      related: ["debtor-statement"],
      sources: s.sources,
    });
  });

  it("rowToArticle reads a stored copy back with the same content", () => {
    const row = { ...starterToRow(s), id: "11111111-1111-4111-8111-111111111111", updated_at: "2026-10-21T00:00:00Z", deleted_at: null };
    const a = rowToArticle(row);
    expect(a).toMatchObject({ id: row.id, starterSlug: "debtor-aging", starterVersion: 3, edited: false, title: s.title, desktopSteps: "Reports > Debtor Aging", cloudSteps: null, sources: s.sources });
    expect(a.deletedAt).toBeUndefined();
  });

  it("rowToArticle drops malformed sources instead of failing", () => {
    const row = { ...starterToRow(s), id: "x", updated_at: "2026-10-21T00:00:00Z", deleted_at: null, sources: [{ label: "ok", url: "https://a.b" }, "junk", { url: "https://c.d" }] };
    expect(rowToArticle(row).sources).toEqual([{ label: "ok", url: "https://a.b" }]);
  });
});

describe("stepsChanged", () => {
  const before = { desktopSteps: null, cloudSteps: "Accounting Menu > Reports > Debtor Aging" };

  it("is true when a menu path is added, changed or removed, so it needs checking again", () => {
    expect(stepsChanged(before, { ...before, desktopSteps: "A/R > Debtor Aging" })).toBe(true);
    expect(stepsChanged(before, { ...before, cloudSteps: "Reports > Debtor Aging" })).toBe(true);
    expect(stepsChanged(before, { ...before, cloudSteps: null })).toBe(true);
  });

  it("is false when only other text changes", () => {
    expect(stepsChanged(before, { ...before })).toBe(false);
  });
});
