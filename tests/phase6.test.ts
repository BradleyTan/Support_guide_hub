import { describe, expect, it } from "vitest";
import { DEFAULT_REPLY_TEMPLATE, PLACEHOLDERS, analysisValues, entriesText, fillTemplate, formatForChannel, guideValues, templateInputSchema, unfilledPlaceholders } from "@/lib/templates";
import { move, parseSteps, sopFromGuide, sopInputSchema } from "@/lib/sop";
import { compareVersionsDesc, releaseNoteInputSchema } from "@/lib/release-notes";
import { guides } from "@/lib/mock/guides";
import { analyses } from "@/lib/mock/analyses";
import { templates } from "@/lib/mock/library";
import { journalTotals } from "@/lib/guide-utils";
import type { Guide } from "@/lib/types";

const guide: Guide = { ...guides[0], title: "Invoice prints blank", product: "AutoCount Accounting", version: "2.1", module: "Printing", cause: "The report template was not copied", steps: ["Export the template", "Import it on the new PC"], prevention: "" };

describe("fillTemplate", () => {
  it("fills placeholders from a guide", () => {
    const out = fillTemplate("Hi {contact},\n\nSteps:\n{steps}\n\nProduct: {product} {version}", guideValues(guide, "Ms Tan"));
    expect(out).toBe("Hi Ms Tan,\n\nSteps:\n1. Export the template\n2. Import it on the new PC\n\nProduct: AutoCount Accounting 2.1");
  });

  it("leaves out lines whose placeholders are empty, and collapses the blank lines left behind", () => {
    const out = fillTemplate(DEFAULT_REPLY_TEMPLATE, guideValues(guide, "Ms Tan"));
    expect(out).toContain("This happens because The report template was not copied.");
    expect(out).not.toContain("To prevent this");
    expect(out).not.toContain("{entries}");
    expect(out).not.toMatch(/\n{3,}/);
  });

  it("keeps a line with text and an empty placeholder only when another placeholder on it has a value", () => {
    expect(fillTemplate("{product} {version}", { product: "AutoCount POS" })).toBe("AutoCount POS");
    expect(fillTemplate("Version: {version}\nEnd", { product: "x" })).toBe("End");
  });

  it("keeps unknown {words} as typed and handles Windows line endings", () => {
    expect(fillTemplate("Ref {ticket}\r\nHi {contact}", { contact: "Ali" })).toBe("Ref {ticket}\nHi Ali");
  });

  it("lists placeholders this reply can't fill (once each)", () => {
    expect(unfilledPlaceholders("{cause} {cause} {prevention} {steps} {unknown}", guideValues(guide, "x"))).toEqual(["prevention"]);
    // {entries} only ever comes from an analysis, so it isn't reported as missing for a guide (and vice versa).
    expect(unfilledPlaceholders(DEFAULT_REPLY_TEMPLATE, guideValues(guide, "x"), "guide")).toEqual(["prevention"]);
    expect(unfilledPlaceholders("{steps} {entries}", { entries: "" }, "analysis")).toEqual(["entries"]);
  });

  it("every sample reply template only uses known placeholders", () => {
    const known = new Set(PLACEHOLDERS.map((p) => p.key));
    for (const t of templates.filter((x) => x.kind === "Reply")) for (const [, k] of t.body.matchAll(/\{([a-z]+)\}/g)) expect(known.has(k as never), `${t.title}: {${k}}`).toBe(true);
  });
});

describe("analysis replies", () => {
  it("lists every journal line with its amount and the balanced totals", () => {
    const a = analyses[0];
    const text = entriesText(a);
    for (const e of a.entries) {
      expect(text).toContain(e.description);
      expect(text).toContain(`Total Dr RM ${journalTotals(e).dr.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    const v = analysisValues(a, "Encik Ali");
    expect(v.title).toBe(a.title);
    expect(v.entries!.startsWith("The entries are:\n")).toBe(true);
    expect(v.steps).toBeUndefined(); // menu paths aren't confirmed, so they're never put in a client reply
  });
});

describe("formatForChannel", () => {
  const text = "Hi Ali,\n\nPlease follow these steps:\n1. Open Tools\n- Check the printer\n\n\n\nThanks";
  it("leaves email as written", () => {
    expect(formatForChannel(text, "email")).toBe(text);
  });
  it("makes headings bold, bullets round and removes extra blank lines for WhatsApp", () => {
    expect(formatForChannel(text, "whatsapp")).toBe("Hi Ali,\n\n*Please follow these steps:*\n1. Open Tools\n• Check the printer\n\nThanks");
  });
});

describe("templateInputSchema", () => {
  it("needs a name and text, and tidies tags", () => {
    expect(templateInputSchema.safeParse({ kind: "Reply", title: "", body: "x" }).success).toBe(false);
    expect(templateInputSchema.safeParse({ kind: "Email", title: "x", body: "x" }).success).toBe(false);
    expect(templateInputSchema.parse({ kind: "SQL", title: " Check ", body: "SELECT 1", tags: [" GL "] })).toEqual({ kind: "SQL", title: "Check", body: "SELECT 1", tags: ["gl"] });
  });
});

describe("SOPs", () => {
  it("start from a guide's steps, scope and prevention", () => {
    const s = sopFromGuide({ ...guide, id: "G-1001", prevention: "Copy templates when moving PCs" });
    expect(s).toEqual({
      guideCode: "G-1001",
      title: "SOP: Invoice prints blank",
      version: "2.1",
      purpose: "How to resolve: Invoice prints blank",
      scope: "AutoCount Accounting 2.1, Printing",
      steps: [
        { text: "Export the template", attachmentId: null },
        { text: "Import it on the new PC", attachmentId: null },
      ],
      checks: ["Prevention: Copy templates when moving PCs"],
    });
    expect(sopInputSchema.safeParse(s).success).toBe(true);
  });

  it("need at least one step and at most 50, each non-empty", () => {
    const base = sopFromGuide({ ...guide, id: "G-1001" });
    expect(sopInputSchema.safeParse({ ...base, steps: [] }).success).toBe(false);
    expect(sopInputSchema.safeParse({ ...base, steps: [{ text: "  ", attachmentId: null }] }).success).toBe(false);
    expect(sopInputSchema.safeParse({ ...base, steps: Array.from({ length: 51 }, () => ({ text: "x", attachmentId: null })) }).success).toBe(false);
    expect(sopInputSchema.safeParse({ ...base, steps: [{ text: "x", attachmentId: "not-a-uuid" }] }).success).toBe(false);
  });

  it("read stored steps defensively", () => {
    expect(parseSteps([{ text: "ok", attachmentId: null }, { text: "" }, "junk", { text: "two" }])).toEqual([
      { text: "ok", attachmentId: null },
      { text: "two", attachmentId: null },
    ]);
    expect(parseSteps(null)).toEqual([]);
  });

  it("move steps up and down without falling off either end", () => {
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("version notes", () => {
  it("sort versions newest first, number by number", () => {
    expect(["2.1", "2.10", "2.9", "1.9.9", "2.2 SP1", "2.2"].sort(compareVersionsDesc)).toEqual(["2.10", "2.9", "2.2 SP1", "2.2", "2.1", "1.9.9"]);
  });

  it("need a product, version and title; guide links must be guide numbers", () => {
    const ok = { product: "AutoCount POS", version: "2.2", type: "Fix", title: "Drawer opens twice", guideCodes: ["G-1001"] };
    expect(releaseNoteInputSchema.safeParse(ok).success).toBe(true);
    expect(releaseNoteInputSchema.safeParse({ ...ok, product: "" }).success).toBe(false);
    expect(releaseNoteInputSchema.safeParse({ ...ok, version: " " }).success).toBe(false);
    expect(releaseNoteInputSchema.safeParse({ ...ok, guideCodes: ["1001"] }).success).toBe(false);
  });
});
