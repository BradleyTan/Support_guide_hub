import { describe, expect, it } from "vitest";
import { articleBody, htmlToText, isFetchableArticle, searchQuery, toGuideSource, toKnowledgeSources, toOfficialSource } from "@/lib/accountant/core/sources";

const guideRow = { id: "g1", code: "G-1001", title: "Bank charge on receipt", symptom: "Customer paid less", cause: "Bank fee", steps: ["Open A/R > A/R Payment", "Enter the bank charge"], verified: true, platform: "desktop" };
const articleRow = {
  id: "k1",
  title: "Debtor aging",
  tell_customer: "Shows who owes you and for how long.",
  what_it_is: "In AutoCount Cloud the report is under Reports > Debtor Aging.",
  desktop_steps: "A/R > Reports > Debtor Aging",
  cloud_steps: "Accounting Menu > Reports > Debtor Aging",
  steps_verified: true,
  reviewed: true,
};

describe("toGuideSource", () => {
  it("uses the guide's platform and verified flag, and links to the guide", () => {
    const s = toGuideSource(guideRow);
    expect(s).toMatchObject({ kind: "my-guide", platform: "desktop", checked: true, url: "/guides/G-1001", title: "Bank charge on receipt" });
    expect(s.text).toContain("A/R > A/R Payment");
    expect(toGuideSource({ ...guideRow, verified: false, platform: "both" })).toMatchObject({ checked: false, platform: "both" });
  });
});

describe("toKnowledgeSources", () => {
  it("knowledge article gives separate desktop and cloud sources", () => {
    const [explain, desktop, cloud] = toKnowledgeSources(articleRow);
    expect(desktop).toMatchObject({ kind: "knowledge", platform: "desktop", checked: true, text: "A/R > Reports > Debtor Aging", url: "/knowledge/k1" });
    expect(cloud).toMatchObject({ kind: "knowledge", platform: "cloud", checked: true, text: "Accounting Menu > Reports > Debtor Aging" });
    // The explanation can inform the answer but has no platform, so it can never confirm a menu path.
    expect(explain).toMatchObject({ kind: "knowledge", platform: null });
    expect(explain.text).toContain("Shows who owes you");
  });

  it("leaves out missing steps and marks unchecked steps", () => {
    const list = toKnowledgeSources({ ...articleRow, desktop_steps: null, steps_verified: false });
    expect(list.map((s) => s.platform)).toEqual([null, "cloud"]);
    expect(list[1].checked).toBe(false);
  });
});

describe("toOfficialSource", () => {
  it("official source is cloud and checked", () => {
    const s = toOfficialSource({ url: "https://help.accounting.autocountcloud.com/support/solutions/articles/1-x", title: "Receive payment", snippet: "Short" }, "Go to Sales > Receive Payment");
    expect(s).toMatchObject({ kind: "official", platform: "cloud", checked: true, text: "Go to Sales > Receive Payment" });
    expect(toOfficialSource({ url: "https://x", title: "t", snippet: "Only the summary" }, "").text).toBe("Only the summary");
  });
});

describe("htmlToText", () => {
  it("htmlToText keeps breadcrumb arrows and drops scripts", () => {
    const html = `<html><head><style>p{}</style><script>alert("x")</script></head><body><h1>Receive payment</h1><p>Go to <b>Sales</b> &gt; Receive&nbsp;Payment</p><ul><li>One</li><li>Two &amp; three</li></ul></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Go to Sales > Receive Payment");
    expect(text).toContain("Two & three");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("p{}");
    expect(text.split("\n")).toContain("One");
  });
});

describe("isFetchableArticle", () => {
  it("isFetchableArticle rejects /support/search", () => {
    expect(isFetchableArticle("https://help.accounting.autocountcloud.com/support/solutions/articles/69000874912-lhdn-calculator")).toBe(true);
    expect(isFetchableArticle("https://help.accounting.autocountcloud.com/support/search/solutions?term=x")).toBe(false);
    expect(isFetchableArticle("https://evil.example.com/support/solutions/articles/1-x")).toBe(false);
    expect(isFetchableArticle("http://help.accounting.autocountcloud.com/support/solutions/articles/1-x")).toBe(false);
  });
});

describe("searchQuery", () => {
  it("turns a long scenario into an OR of its key words, without placeholders, numbers or filler", () => {
    const q = searchQuery("[COMPANY 1] received the AR deposit 2 years ago but never opened an AR deposit, and wants to knock off an invoice for RM5,000 last month");
    expect(q.split(" or ")).toEqual(expect.arrayContaining(["deposit", "knock", "invoice"]));
    expect(q).not.toMatch(/COMPANY|5,000|\bthe\b|\band\b/);
    expect(q.split(" or ").length).toBeLessThanOrEqual(8);
    expect(new Set(q.split(" or ")).size).toBe(q.split(" or ").length);
  });

  it("is empty for text with no useful words", () => {
    expect(searchQuery("[IC 1] and the 123")).toBe("");
  });
});

describe("articleBody", () => {
  it("keeps only the article body when the page marks it", () => {
    const html = `<nav>Home > Menu</nav><div class="article-body" id="article-body"><p>Go to Sales &gt; Invoice</p></div><footer>Footer</footer>`;
    expect(htmlToText(articleBody(html))).toBe("Go to Sales > Invoice");
    expect(articleBody("<p>No marker</p>")).toBe("<p>No marker</p>");
  });
});
