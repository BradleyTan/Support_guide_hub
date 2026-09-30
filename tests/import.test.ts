import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { autoMapColumns, normalizeCategory, normalizeProduct, parseSteps, reviewRows, splitHeader } from "@/lib/import";
import { closestMatch, titleSimilarity } from "@/lib/similarity";

const existing = [{ code: "G-1051", title: "Workstations can't connect to SQL Server after a Windows update" }];

function sheetFromCsv(csv: string) {
  const wb = XLSX.read(csv, { type: "string" });
  // Same options as the import wizard.
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "", blankrows: true });
}

describe("autoMapColumns", () => {
  it("maps common support-log headings", () => {
    expect(autoMapColumns(["Issue", "Software", "Ver", "Error", "Solution", "Customer", "Remarks"])).toEqual([
      "title",
      "product",
      "version",
      "errorMessage",
      "steps",
      "skip",
      "prevention",
    ]);
  });

  it("uses each field once and ignores blank headings", () => {
    expect(autoMapColumns(["Title", "Subject", ""])).toEqual(["title", "skip", "skip"]);
  });

  it("matches headings with extra words", () => {
    expect(autoMapColumns(["Issue title", "Error message", "Root cause"])).toEqual(["title", "errorMessage", "cause"]);
  });
});

describe("value normalisation", () => {
  it("recognises product names and short forms", () => {
    expect(normalizeProduct("accounting")).toBe("AutoCount Accounting");
    expect(normalizeProduct("AutoCount POS")).toBe("AutoCount POS");
    expect(normalizeProduct("HRMS")).toBe("AutoCount Payroll");
    expect(normalizeProduct("Account Book")).toBe("AutoCount Account Book");
    expect(normalizeProduct("SQL Account")).toBeNull();
    expect(normalizeProduct("")).toBeNull();
  });

  it("recognises categories loosely", () => {
    expect(normalizeCategory("bank & cash")).toBe("Bank & Cash");
    expect(normalizeCategory("Tax")).toBe("Tax (SST / e-Invoice)");
    expect(normalizeCategory("random")).toBeNull();
  });

  it("splits fix steps by line or semicolon", () => {
    expect(parseSteps("Export template; Import on new PC")).toEqual(["Export template", "Import on new PC"]);
    expect(parseSteps("1. A\n2. B")).toEqual(["A", "B"]);
  });
});

describe("similarity", () => {
  it("scores near-identical titles high and unrelated ones low", () => {
    expect(titleSimilarity("SQL Server not found after Windows update", "SQL server NOT found after windows update!")).toBeGreaterThan(0.9);
    expect(titleSimilarity("Invoice prints blank", "PCB bonus month")).toBeLessThan(0.2);
  });

  it("finds the closest existing guide", () => {
    expect(closestMatch("Workstations cannot connect to SQL Server after Windows update", existing)?.item.code).toBe("G-1051");
    expect(closestMatch("Stock take variance posting", existing)).toBeNull();
  });
});

describe("reviewRows with a real CSV (parsed by SheetJS)", () => {
  const csv = [
    "Customer,Issue,Software,Error,Solution",
    'Sinar,"Cannot print invoice",Accounting,,"Reimport template; set as default"',
    'Lim,"Workstations cannot connect to SQL Server after a Windows update",Accounting,"server not found","Open 1433"',
    'Jaya,"EPF rate wrong for foreign worker",Payroll,,"Check EPF table"',
    ',,POS,,"Restart sync"',
    ',,,,',
    'Borneo,"Cannot print invoice",Accounting,,"Duplicate within file"',
    'Nexus,"Unknown product row",SQL Account,,"x"',
  ].join("\n");

  const table = splitHeader(sheetFromCsv(csv))!;
  const rows = reviewRows(table.rows, autoMapColumns(table.headers), { existing, firstRowNumber: table.firstRowNumber });

  it("skips blank lines and keeps Excel row numbers", () => {
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3, 4, 5, 7, 8]);
  });

  it("marks good rows ready and never imports the Customer column", () => {
    const first = rows[0];
    expect(first.status).toBe("ok");
    expect(first.input).toMatchObject({ title: "Cannot print invoice", product: "AutoCount Accounting", steps: ["Reimport template", "set as default"] });
    expect(JSON.stringify(first.input)).not.toContain("Sinar");
  });

  it("flags duplicates of existing guides and of earlier rows in the file", () => {
    expect(rows[1]).toMatchObject({ status: "duplicate", duplicateOf: { code: "G-1051" } });
    expect(rows[4]).toMatchObject({ status: "duplicate", duplicateOf: { code: "row 2" } });
  });

  it("flags rows with no title or an unknown product", () => {
    expect(rows[3].status).toBe("error");
    expect(rows[3].problems.join(" ")).toMatch(/title/i);
    expect(rows[5].status).toBe("error");
    expect(rows[5].problems.join(" ")).toMatch(/Unknown product/);
  });

  it("uses the default product for rows without one", () => {
    const t = splitHeader(sheetFromCsv('Issue,Solution\n"Printer offline","Restart spooler"'))!;
    const r = reviewRows(t.rows, autoMapColumns(t.headers), { existing: [], defaultProduct: "AutoCount POS" });
    expect(r[0]).toMatchObject({ status: "ok", input: { product: "AutoCount POS" } });
  });
});

describe("splitHeader", () => {
  it("finds a heading row below title lines", () => {
    const t = splitHeader([["My support log"], [], ["Issue", "Solution"], ["A", "B"]]);
    expect(t).toMatchObject({ headers: ["Issue", "Solution"], firstRowNumber: 4 });
  });

  it("returns null when there's no heading row", () => {
    expect(splitHeader([["only one cell"], [1, 2]])).toBeNull();
  });
});
