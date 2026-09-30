import { describe, expect, it } from "vitest";
import { buildSiteQuery, googleFallbackUrl, HELP_CENTRES, isAllowedUrl, OTHER_OFFICIAL_SITES, siteLabel } from "@/lib/official-sites";
import { guideEmbeddingText, toVectorLiteral } from "@/lib/embedding-text";

describe("official sites", () => {
  it("accepts only official hosts and their subdomains", () => {
    expect(isAllowedUrl("https://help.hrms.autocountcloud.com/support/solutions/articles/1-x")).toBe(true);
    expect(isAllowedUrl("https://wiki.autocountsoft.com/wiki/Main_Page")).toBe(true);
    expect(isAllowedUrl("https://www.autocountsoft.com/")).toBe(true);
    expect(isAllowedUrl("https://autocountsoft.com.evil.example/")).toBe(false);
    expect(isAllowedUrl("https://evilautocountsoft.com/")).toBe(false);
    expect(isAllowedUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedUrl("not a url")).toBe(false);
  });

  it("labels links by the most specific site", () => {
    expect(siteLabel("https://wiki.autocountsoft.com/wiki/x")).toBe("AutoCount wiki");
    expect(siteLabel("https://www.autocountsoft.com/")).toBe("AutoCount website");
    expect(siteLabel("https://help.accounting.autocountcloud.com/support/home")).toBe("AutoCount Cloud Accounting help centre");
  });

  it("builds site-limited Google searches", () => {
    expect(buildSiteQuery("  PCB bonus ", ["a.com", "b.com"])).toBe("PCB bonus (site:a.com OR site:b.com)");
    const other = decodeURIComponent(googleFallbackUrl("x", OTHER_OFFICIAL_SITES.map((s) => s.domain)));
    expect(other).toContain("site:wiki.autocountsoft.com");
    expect(other).not.toContain(HELP_CENTRES[0].domain);
  });
});

describe("embedding text", () => {
  it("describes what the guide is about, not the fix", () => {
    const t = guideEmbeddingText({
      title: "Invoice prints blank",
      product: "AutoCount Account Book",
      module: "Printing",
      symptom: "Preview shows no data",
      error_message: null,
      cause: "Template missing",
      tags: ["printing", "template"],
    });
    expect(t).toBe("Invoice prints blank\nAutoCount Account Book Printing\nPreview shows no data\nTemplate missing\nprinting template");
  });

  it("caps very long text", () => {
    expect(guideEmbeddingText({ title: "x".repeat(10_000) }).length).toBe(4000);
  });

  it("formats vectors for pgvector and rejects bad values", () => {
    expect(toVectorLiteral([0.1, -0.2])).toBe("[0.1,-0.2]");
    expect(() => toVectorLiteral([])).toThrow();
    expect(() => toVectorLiteral([Number.NaN])).toThrow();
  });
});
