"use client";

import { useState } from "react";
import { Check, CircleAlert, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

const steps = ["Upload", "Match columns", "Review", "Done"] as const;

const FIELDS = ["Title", "Product", "Version", "Module", "Category", "Symptom", "Error message", "Cause", "Fix steps", "Prevention", "Tags", "Skip this column"];

/** Columns found in the sample file, with the field we'd auto-match them to. */
const sampleColumns = [
  { source: "Issue", sample: "Cannot print invoice", match: "Title" },
  { source: "Software", sample: "AutoCount Accounting", match: "Product" },
  { source: "Ver", sample: "2.1", match: "Version" },
  { source: "Error", sample: "Report template not found", match: "Error message" },
  { source: "Solution", sample: "Reimport template; set as default", match: "Fix steps" },
  { source: "Customer", sample: "Sinar Hardware", match: "Skip this column" },
  { source: "Remarks", sample: "check printer driver too", match: "Prevention" },
];

const reviewRows = [
  { row: 2, title: "Cannot print invoice", product: "Accounting", status: "ok" as const },
  { row: 3, title: "SQL server not found after update", product: "Accounting", status: "duplicate" as const, note: "Looks like G-1051" },
  { row: 4, title: "EPF rate wrong for foreign worker", product: "Payroll", status: "ok" as const },
  { row: 5, title: "", product: "POS", status: "error" as const, note: "No title. This row will be skipped." },
  { row: 6, title: "Stock take variance posting", product: "Accounting", status: "ok" as const },
];

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState(sampleColumns.map((c) => c.match));
  const [dupAction, setDupAction] = useState<"skip" | "import">("skip");

  const ok = reviewRows.filter((r) => r.status === "ok").length;
  const dups = reviewRows.filter((r) => r.status === "duplicate").length;
  const errs = reviewRows.filter((r) => r.status === "error").length;
  const imported = ok + (dupAction === "import" ? dups : 0);

  return (
    <>
      <PageHeader
        title="Import guides"
        description="Bring in your existing Excel or CSV log. You match the columns once, check the rows, then import."
        howItWorks={
          <>
            The file is read in your browser (SheetJS), and only the mapped columns are saved. Each row is checked for a missing title or product and <strong>compared with existing guides to catch duplicates</strong>. Imported guides are marked unverified until you review them.
          </>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label="Import steps">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "num flex size-6 items-center justify-center rounded-full text-xs font-medium",
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-accent text-accent-foreground ring-1 ring-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={i === step ? "font-medium" : "text-muted-foreground"} aria-current={i === step ? "step" : undefined}>
              {s}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="max-w-2xl space-y-4">
          <label
            htmlFor="import-file"
            className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed bg-card px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-accent/30"
          >
            <Upload className="mb-2 size-6 text-muted-foreground" />
            <span className="font-medium">Drop an Excel or CSV file, or select one</span>
            <span className="mt-1 text-sm text-muted-foreground">.xlsx, .xls or .csv · first row must be column headings · up to 5,000 rows</span>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const name = e.target.files?.[0]?.name;
                if (!name) return;
                if (!/\.(xlsx|xls|csv)$/i.test(name)) {
                  setFileError(`${name} isn’t an Excel or CSV file. Save it as .xlsx or .csv and try again.`);
                  setFile(null);
                } else {
                  setFileError(null);
                  setFile(name);
                }
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile("old-support-log-2025.xlsx");
                setFileError(null);
              }}
            >
              <FileSpreadsheet /> Use sample file
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setFile(null); setFileError("old-log.xlsx has no heading row. Add a first row with column names (e.g. Issue, Solution) and upload it again."); }}>
              Try a file with problems
            </Button>
          </div>
          {fileError && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {fileError}
            </p>
          )}
          {file && (
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <FileSpreadsheet className="size-5 text-success" />
              <span className="flex-1">
                <span className="font-medium">{file}</span>
                <span className="block text-xs text-muted-foreground">Sheet “Cases” · 5 rows · 7 columns</span>
              </span>
              <Button size="sm" onClick={() => setStep(1)}>
                Next: match columns
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground">I matched the columns by name. Change any that are wrong. Columns set to “Skip” are not imported. Client names are skipped by default.</p>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column in your file</TableHead>
                  <TableHead>Example value</TableHead>
                  <TableHead className="w-52">Save as</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleColumns.map((c, i) => (
                  <TableRow key={c.source}>
                    <TableCell className="font-medium">{c.source}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{c.sample}</TableCell>
                    <TableCell>
                      <Select value={mapping[i]} onValueChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? String(v) : x)))}>
                        <SelectTrigger size="sm" className="w-full" aria-label={`Save column ${c.source} as`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELDS.map((fld) => (
                            <SelectItem key={fld} value={fld}>
                              {fld}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!mapping.includes("Title") && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <TriangleAlert className="size-4" /> Map one column to Title. Every guide needs one.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={!mapping.includes("Title")} onClick={() => setStep(2)}>
              Next: review rows
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-3xl space-y-4">
          <p className="text-sm">
            <span className="font-medium text-success">{ok} ready</span> · <span className="font-medium text-warning">{dups} possible duplicate</span> · <span className="font-medium text-destructive">{errs} with problems</span>
          </p>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Row</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-28">Product</TableHead>
                  <TableHead className="w-60">Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewRows.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="text-muted-foreground">{r.row}</TableCell>
                    <TableCell className={cn(!r.title && "text-muted-foreground italic")}>{r.title || "(empty)"}</TableCell>
                    <TableCell>{r.product}</TableCell>
                    <TableCell className="whitespace-normal">
                      {r.status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-4" /> Ready
                        </span>
                      )}
                      {r.status === "duplicate" && (
                        <span className="inline-flex items-center gap-1 text-[color-mix(in_oklch,var(--warning),var(--foreground)_35%)]">
                          <CircleAlert className="size-4" /> {r.note}
                        </span>
                      )}
                      {r.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <TriangleAlert className="size-4" /> {r.note}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <fieldset className="space-y-1.5 text-sm">
            <legend className="mb-1 font-medium">Possible duplicates</legend>
            {(["skip", "import"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="dups" checked={dupAction === v} onChange={() => setDupAction(v)} className="accent-(--primary)" />
                {v === "skip" ? "Skip them (recommended)" : "Import them anyway"}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Import {imported} guides</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-xl rounded-lg border bg-card p-6">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">{imported} guides imported</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {errs} row skipped (no title){dupAction === "skip" ? `, ${dups} duplicate skipped` : ""}. The imported guides are marked unverified so you can check them when you have time.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/guides?status=unverified">Review imported guides</ButtonLink>
            <Button variant="outline" onClick={() => { setStep(0); setFile(null); }}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
