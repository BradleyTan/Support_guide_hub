import { describe, expect, it } from "vitest";
import { fieldChanges, withChanges } from "@/lib/guide-history";
import type { GuideInput } from "@/lib/guide-schema";

const base: GuideInput = {
  title: "Bank charge on receipt",
  product: "AutoCount Accounting",
  platform: "desktop",
  version: "2.2",
  module: "A/R",
  category: "Bank & Cash",
  symptom: "Customer paid less",
  errorMessage: "",
  cause: "Bank fee",
  steps: ["Open A/R Payment", "Enter the bank charge"],
  prevention: "",
  tags: ["bank"],
};

describe("fieldChanges", () => {
  it("lists each changed field with its old and new text, in form order", () => {
    const after = { ...base, title: "Bank charge on a receipt", steps: ["Open A/R Payment", "Key in the bank charge", "Save"] };
    expect(fieldChanges(base, after)).toEqual([
      { field: "Title", before: "Bank charge on receipt", after: "Bank charge on a receipt" },
      { field: "Fix steps", before: "1. Open A/R Payment\n2. Enter the bank charge", after: "1. Open A/R Payment\n2. Key in the bank charge\n3. Save" },
    ]);
  });

  it("shows tags as a list and empty fields as empty", () => {
    expect(fieldChanges(base, { ...base, tags: ["bank", "ar"], errorMessage: "Amount mismatch" })).toEqual([
      { field: "Error message", before: "", after: "Amount mismatch" },
      { field: "Tags", before: "bank", after: "bank, ar" },
    ]);
  });

  it("is empty when nothing changed", () => {
    expect(fieldChanges(base, { ...base })).toEqual([]);
  });
});

describe("withChanges", () => {
  const current = { ...base, title: "Third title" };
  const rev = (id: string, summary: string, snapshot: unknown) => ({ id, at: `2026-11-0${id}T00:00:00Z`, summary, snapshot });

  it("compares each edit's saved 'before' with the next edit's 'before', and the latest with the guide as it is now", () => {
    const out = withChanges(
      [rev("1", "Guide created", null), rev("2", "Edited title", { ...base, title: "First title" }), rev("3", "Marked as verified", null), rev("4", "Edited title", { ...base, title: "Second title" })],
      current,
    );
    expect(out.map((r) => r.changes?.map((c) => `${c.before} → ${c.after}`))).toEqual([undefined, ["First title → Second title"], undefined, ["Second title → Third title"]]);
    expect(out.map((r) => r.restorable)).toEqual([false, true, false, true]);
  });

  it("skips a saved version that no longer fits the guide form, so it can't be restored", () => {
    const out = withChanges([rev("1", "Edited title", { title: "x" })], current);
    expect(out[0].changes).toBeUndefined();
    expect(out[0].restorable).toBe(false);
  });
});
