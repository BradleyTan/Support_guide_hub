import { describe, expect, it } from "vitest";
import { foundIn, highlightParts, queryTerms } from "@/lib/highlight";

const marked = (text: string, query: string) =>
  highlightParts(text, queryTerms(query))
    .map((p) => (p.hit ? `[${p.text}]` : p.text))
    .join("");

describe("queryTerms", () => {
  it("keeps the meaningful words and numbers, lower-cased and without duplicates", () => {
    expect(queryTerms("The SQL Server is not found, SQL error 5023")).toEqual(["sql", "server", "found", "error", "5023"]);
  });

  it("ignores very short words and common filler words", () => {
    expect(queryTerms("a to of an it")).toEqual([]);
  });
});

describe("highlightParts", () => {
  it("marks every match, ignoring case", () => {
    expect(marked("Cannot connect to SQL Server; sql is down", "sql server")).toBe("Cannot connect to [SQL] [Server]; [sql] is down");
  });

  it("matches other forms of the same word", () => {
    expect(marked("Posted entries and posting date", "post")).toBe("[Posted] entries and [posting] date");
    expect(marked("Reconcile the bank", "reconciliation")).toBe("[Reconcile] the bank");
  });

  it("only marks words that start with the search word", () => {
    expect(marked("Unposted document", "posted")).toBe("Unposted document");
  });

  it("leaves text unchanged when nothing matches", () => {
    expect(marked("Bank charge on receipt", "payroll")).toBe("Bank charge on receipt");
    expect(highlightParts("", ["sql"])).toEqual([]);
  });
});

describe("foundIn", () => {
  it("names the guide fields that contain a search word", () => {
    const g = { title: "Bank charge on receipt", errorMessage: "", symptom: "Customer paid less", cause: "Bank fee", steps: ["Open A/R Payment", "Enter the bank charge"] };
    expect(foundIn(g, queryTerms("bank charge"))).toEqual(["title", "cause", "fix steps"]);
    expect(foundIn(g, queryTerms("customer"))).toEqual(["symptom"]);
    expect(foundIn(g, queryTerms("payroll"))).toEqual([]);
  });
});
