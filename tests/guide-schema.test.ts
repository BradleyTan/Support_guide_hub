import { describe, expect, it } from "vitest";
import { describeChanges, guideInputSchema, guideToInput, inputToRow, splitLines, splitTags } from "@/lib/guide-schema";
import { guides } from "@/lib/mock/guides";

const valid = { title: "Invoice prints blank", product: "AutoCount Account Book", steps: ["Re-import template"] };

describe("guideInputSchema", () => {
  it("accepts a minimal guide and fills defaults", () => {
    const r = guideInputSchema.parse(valid);
    expect(r).toMatchObject({ version: "", module: "", category: null, tags: [], errorMessage: "" });
  });

  it("requires a title, a product and at least one step", () => {
    const r = guideInputSchema.safeParse({ title: "  ", steps: [] });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["title", "product", "steps"]));
  });

  it("rejects unknown products and categories", () => {
    expect(guideInputSchema.safeParse({ ...valid, product: "SQL Accounting" }).success).toBe(false);
    expect(guideInputSchema.safeParse({ ...valid, category: "Misc" }).success).toBe(false);
  });

  it("rejects over-long text", () => {
    expect(guideInputSchema.safeParse({ ...valid, title: "x".repeat(301) }).success).toBe(false);
    expect(guideInputSchema.safeParse({ ...valid, symptom: "x".repeat(4001) }).success).toBe(false);
  });

  it("keeps special characters and non-English text intact", () => {
    const r = guideInputSchema.parse({ ...valid, title: "PCB 扣税 – ‘bonus’ <b>&amp;</b> café" });
    expect(r.title).toBe("PCB 扣税 – ‘bonus’ <b>&amp;</b> café");
  });

  it("round-trips every sample guide through the form model", () => {
    for (const g of guides) expect(guideInputSchema.safeParse(guideToInput(g)).success, g.id).toBe(true);
  });

  it("stores empty optional text as null", () => {
    const row = inputToRow(guideInputSchema.parse(valid));
    expect(row.error_message).toBeNull();
    expect(row.cause).toBeNull();
    expect(row.prevention).toBeNull();
  });
});

describe("splitLines / splitTags", () => {
  it("strips list numbering and bullets", () => {
    expect(splitLines("1. Open firewall\n2) Restart\n- Test\n• Done\n\n")).toEqual(["Open firewall", "Restart", "Test", "Done"]);
  });

  it("normalises tags", () => {
    expect(splitTags("SST, bank recon; SST\nMy Tag")).toEqual(["sst", "bank-recon", "my-tag"]);
  });
});

describe("describeChanges", () => {
  const before = guideToInput(guides[0]);
  it("returns null when nothing changed", () => {
    expect(describeChanges(before, { ...before })).toBeNull();
  });
  it("names the changed fields", () => {
    expect(describeChanges(before, { ...before, title: "New", steps: ["x"] })).toBe("Edited title, fix steps");
  });
  it("summarises many changes", () => {
    const s = describeChanges(before, { ...before, title: "a", symptom: "b", cause: "c", prevention: "d", tags: [] });
    expect(s).toMatch(/and \d more$/);
  });
});
