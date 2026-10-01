import { describe, expect, it } from "vitest";
import { NOTE_HEADERS, NOTE_TITLE_MAX, notesToSheet, parseNotes, pdfItemsToText } from "@/lib/import-notes";
import { autoMapColumns, reviewRows, splitHeader } from "@/lib/import";

// The user's own example notes (1 Oct 2026), typos kept as written.
const SAMPLE = `Issue: AutoCount Accounting - e-Invoice statusL: Invalid, submissioin failed... Buyer Tin is invalid. Kindly please use Search TIN function to get the correct TIN
Solution: Make sure the TIN is correct using the search tin function. If is government, TIN and BRN leave blank, but debtor tax entity/tin must fill up in the debtor maintenance

Issue: AutoCount Accounting - Tax > Tax Code Maintenance > Configure Malaysia SST > SST Option > SST Setting > SST on Payment > Credit Account No, what to put?
Solution:Put the same acc no as the debit acc no. It is use for invoice posting. Anything related to sst will post to this account.`;

describe("parseNotes", () => {
  it("reads each Issue / Solution pair in the user's notes", () => {
    const [a, b] = parseNotes(SAMPLE);
    expect(parseNotes(SAMPLE)).toHaveLength(2);
    expect(a.product).toBe("AutoCount Accounting");
    expect(a.title).toBe("e-Invoice statusL: Invalid, submissioin failed... Buyer Tin is invalid. Kindly please use Search TIN function to get the correct TIN");
    expect(a.symptom).toBe("");
    expect(a.steps).toBe(
      "Make sure the TIN is correct using the search tin function. If is government, TIN and BRN leave blank, but debtor tax entity/tin must fill up in the debtor maintenance",
    );
    expect(b.title).toMatch(/^Tax > Tax Code Maintenance > .* Credit Account No, what to put\?$/);
    expect(b.steps).toBe("Put the same acc no as the debit acc no. It is use for invoice posting. Anything related to sst will post to this account.");
  });

  it("works when a PDF gives the text with no line breaks", () => {
    const flat = SAMPLE.replace(/\s*\n\s*/g, " ");
    const entries = parseNotes(flat);
    expect(entries).toHaveLength(2);
    expect(entries[1].steps).toMatch(/^Put the same acc no/);
    expect(entries[0].steps).not.toMatch(/Issue:/);
  });

  it("only starts a new guide at a line beginning with Issue: when the file has line breaks", () => {
    const [only, ...rest] = parseNotes("Issue: AutoCount Payroll - PCB wrong\nSolution: The issue: PCB table was old. Update it.");
    expect(rest).toHaveLength(0);
    expect(only.steps).toBe("The issue: PCB table was old. Update it.");
  });

  it("is not fooled by case, extra spaces, other dashes or a '(Product)' label", () => {
    const [e] = parseNotes("  ISSUE :  AutoCount Payroll (Product) – Payslip   email not sent\n  SOLUTION :   Check SMTP");
    expect(e).toEqual({ title: "Payslip email not sent", product: "AutoCount Payroll", symptom: "", steps: "Check SMTP" });
  });

  it("keeps the text whole when the part before the dash isn't a product", () => {
    const [e] = parseNotes("Issue: Year-end - closing fails\nSolution: Run the period check first");
    expect(e.product).toBe("");
    expect(e.title).toBe("Year-end - closing fails");
  });

  it("splits numbered steps, one per line or several on one line", () => {
    expect(parseNotes("Issue: x\nSolution:\n1. Open Tools\n2. Pick printer").at(0)!.steps).toBe("1. Open Tools\n2. Pick printer");
    expect(parseNotes("Issue: x\nSolution: 1. Open Tools 2. Pick printer 3) Restart").at(0)!.steps).toBe("1. Open Tools\n2. Pick printer\n3) Restart");
  });

  it("shortens a very long issue for the title and keeps the full text as the symptom", () => {
    const long = "word ".repeat(80).trim();
    const [e] = parseNotes(`Issue: AutoCount POS - ${long}\nSolution: fix`);
    expect(e.title.length).toBeLessThanOrEqual(NOTE_TITLE_MAX);
    expect(e.title.endsWith("…")).toBe(true);
    expect(e.symptom).toBe(long);
  });

  it("finds nothing in text without Issue:", () => {
    expect(parseNotes("Meeting notes\nNothing here")).toEqual([]);
    expect(parseNotes("")).toEqual([]);
  });
});

describe("notes through the import review", () => {
  it("become ready-to-import guides with the columns matched automatically", () => {
    const table = splitHeader(notesToSheet(parseNotes(SAMPLE)))!;
    expect(table.headers).toEqual([...NOTE_HEADERS]);
    const mapping = autoMapColumns(table.headers);
    expect(mapping).toEqual(["title", "product", "symptom", "steps"]);
    const rows = reviewRows(table.rows, mapping, { existing: [], firstRowNumber: 1 });
    expect(rows.map((r) => r.status)).toEqual(["ok", "ok"]);
    expect(rows[0].input).toMatchObject({ product: "AutoCount Accounting", steps: [expect.stringMatching(/^Make sure the TIN/)] });
  });

  it("flag notes with no product or no solution instead of guessing", () => {
    const table = splitHeader(notesToSheet(parseNotes("Issue: Printing - blank invoice\nSolution: reinstall\n\nIssue: AutoCount Accounting - no answer yet")))!;
    const rows = reviewRows(table.rows, autoMapColumns(table.headers), { existing: [], firstRowNumber: 1 });
    expect(rows[0].status).toBe("error");
    expect(rows[0].problems).toContain("No product");
    expect(rows[1].status).toBe("error");
    expect(rows[1].problems).toContain("Add at least one fix step.");
  });
});

describe("pdfItemsToText", () => {
  it("keeps line breaks from the PDF and separates pages", () => {
    const text = pdfItemsToText([
      [
        { str: "Issue: AutoCount POS - drawer", hasEOL: true },
        { str: "Solution: ", hasEOL: false },
        { str: "check port", hasEOL: true },
      ],
      [{ str: "Issue: AutoCount POS - printer", hasEOL: false }],
    ]);
    expect(text).toBe("Issue: AutoCount POS - drawer\nSolution: check port\n\nIssue: AutoCount POS - printer");
    expect(parseNotes(text).map((e) => e.steps)).toEqual(["check port", ""]);
  });
});
