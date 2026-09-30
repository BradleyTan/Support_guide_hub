"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Download, FileSpreadsheet, Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { importGuides } from "@/app/(app)/guides/actions";
import { autoMapColumns, FIELD_LABEL, IMPORT_FIELDS, reviewRows, splitHeader, type Mapping, type ReviewedRow } from "@/lib/import";
import { shortProduct } from "@/lib/guide-utils";
import { PRODUCTS, type Product } from "@/lib/types";

const steps = ["Upload", "Match columns", "Review", "Done"] as const;
const MAX_FILE_MB = 5;
const MAX_ROWS = 5000;
const NO_DEFAULT = "none";

interface Parsed {
  fileName: string;
  sheets: Record<string, unknown[][]>;
  sheet: string;
}

const TEMPLATE =
  "Title,Product,Version,Module,Category,Symptom,Error message,Cause,Fix steps,Prevention,Tags\n" +
  '"Invoice prints blank on new PC",AutoCount Account Book,2.1,Printing,Printing & Reports,"Preview shows layout but no data",,"Custom template not copied","Export template from old PC; Import on new PC and set as default",,"printing, template"\n';

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "guides-import-template.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ existing }: { existing: { code: string; title: string }[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [mapping, setMapping] = useState<Mapping>([]);
  const [defaultProduct, setDefaultProduct] = useState<string>(NO_DEFAULT);
  const [dupAction, setDupAction] = useState<"skip" | "import">("skip");
  const [importing, startImport] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const table = useMemo(() => (parsed ? splitHeader(parsed.sheets[parsed.sheet]) : null), [parsed]);

  async function readFile(file: File) {
    setFileError(null);
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setFileError(`${file.name} isn’t an Excel or CSV file. Save it as .xlsx or .csv and try again.`);
    if (file.size > MAX_FILE_MB * 1024 * 1024) return setFileError(`${file.name} is larger than ${MAX_FILE_MB} MB. Split it into smaller files.`);
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheets: Record<string, unknown[][]> = {};
      // Keep blank lines so row numbers in the review match the spreadsheet; the review skips them.
      for (const name of wb.SheetNames) sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true });
      const first = wb.SheetNames.find((n) => splitHeader(sheets[n])) ?? wb.SheetNames[0];
      if (!first || !splitHeader(sheets[first])) {
        setFileError(`${file.name} has no heading row. Add a first row with column names (e.g. Issue, Solution) and upload it again.`);
        return;
      }
      choose({ fileName: file.name, sheets, sheet: first });
    } catch {
      setFileError(`${file.name} couldn’t be read. If it’s password-protected or damaged, save a fresh copy and try again.`);
    } finally {
      setReading(false);
    }
  }

  function choose(p: Parsed) {
    setParsed(p);
    const t = splitHeader(p.sheets[p.sheet]);
    setMapping(t ? autoMapColumns(t.headers) : []);
  }

  const review: ReviewedRow[] = useMemo(() => {
    if (!table || step < 2) return [];
    return reviewRows(table.rows.slice(0, MAX_ROWS), mapping, {
      existing,
      defaultProduct: defaultProduct === NO_DEFAULT ? undefined : (defaultProduct as Product),
      firstRowNumber: table.firstRowNumber,
    });
  }, [table, mapping, existing, defaultProduct, step]);

  const ok = review.filter((r) => r.status === "ok");
  const dups = review.filter((r) => r.status === "duplicate");
  const errs = review.filter((r) => r.status === "error");
  const toImport = [...ok, ...(dupAction === "import" ? dups : [])];
  const hasTitle = mapping.includes("title");
  const hasProduct = mapping.includes("product") || defaultProduct !== NO_DEFAULT;

  function runImport() {
    startImport(async () => {
      const res = await importGuides(
        toImport.map((r) => r.input),
        parsed!.fileName,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ imported: res.data.imported, skipped: review.length - res.data.imported });
      setStep(3);
      router.refresh();
    });
  }

  function reset() {
    setStep(0);
    setParsed(null);
    setResult(null);
    setFileError(null);
    setDefaultProduct(NO_DEFAULT);
  }

  return (
    <>
      <PageHeader
        title="Import guides"
        description="Bring in your existing Excel or CSV log. You match the columns once, check the rows, then import."
        actions={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download /> Download template
          </Button>
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) readFile(f);
            }}
            className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed bg-card px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-accent/30"
          >
            {reading ? <Loader2 className="mb-2 size-6 animate-spin text-muted-foreground" /> : <Upload className="mb-2 size-6 text-muted-foreground" />}
            <span className="font-medium">{reading ? "Reading the file…" : "Drop an Excel or CSV file, or select one"}</span>
            <span className="mt-1 text-sm text-muted-foreground">
              .xlsx, .xls or .csv · a heading row with column names · up to {MAX_ROWS.toLocaleString()} rows, {MAX_FILE_MB} MB
            </span>
            <input
              ref={fileInput}
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">The file is read in your browser. Only the rows you choose to import are saved.</p>
          {fileError && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {fileError}
            </p>
          )}
          {parsed && table && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <FileSpreadsheet className="size-5 text-success" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{parsed.fileName}</span>
                <span className="block text-xs text-muted-foreground">
                  {table.rows.length.toLocaleString()} rows · {table.headers.length} columns
                  {table.rows.length > MAX_ROWS && ` · only the first ${MAX_ROWS.toLocaleString()} rows will be imported`}
                </span>
              </span>
              {Object.keys(parsed.sheets).length > 1 && (
                <Select value={parsed.sheet} onValueChange={(v) => choose({ ...parsed, sheet: String(v) })}>
                  <SelectTrigger size="sm" aria-label="Sheet" className="min-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(parsed.sheets).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={() => setStep(1)}>
                Next: match columns
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 1 && table && (
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-muted-foreground">I matched the columns by their names. Change any that are wrong. Columns set to “Skip” aren’t imported, so client names and other private columns can be left out.</p>
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
                {table.headers.map((h, i) => (
                  <TableRow key={`${h}-${i}`}>
                    <TableCell className="font-medium">{h || <span className="text-muted-foreground italic">(no name)</span>}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{String(table.rows.find((r) => String(r[i] ?? "").trim())?.[i] ?? "")}</TableCell>
                    <TableCell>
                      <Select value={mapping[i]} onValueChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? (v as Mapping[number]) : x === v && v !== "skip" ? "skip" : x)))}>
                        <SelectTrigger size="sm" className="w-full" aria-label={`Save column ${h || i + 1} as`}>
                          <SelectValue>{(v: Mapping[number]) => FIELD_LABEL[v]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {[...IMPORT_FIELDS, "skip" as const].map((fld) => (
                            <SelectItem key={fld} value={fld}>
                              {FIELD_LABEL[fld]}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default-product">Product for rows without one</Label>
            <Select value={defaultProduct} onValueChange={(v) => setDefaultProduct(String(v))}>
              <SelectTrigger id="default-product" className="w-full max-w-xs bg-card">
                <SelectValue>{(v: string) => (v === NO_DEFAULT ? "None (flag the row)" : shortProduct(v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>None (flag the row)</SelectItem>
                {PRODUCTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {shortProduct(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(!hasTitle || !hasProduct) && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <TriangleAlert className="size-4" /> {!hasTitle ? "Match one column to Title. Every guide needs one." : "Match a Product column, or choose a product for rows without one."}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button disabled={!hasTitle || !hasProduct} onClick={() => setStep(2)}>
              Next: review rows
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-4xl space-y-4">
          <p className="text-sm">
            <span className="font-medium text-success">{ok.length} ready</span> · <span className="font-medium text-warning">{dups.length} possible duplicate{dups.length === 1 ? "" : "s"}</span> ·{" "}
            <span className="font-medium text-destructive">
              {errs.length} with problem{errs.length === 1 ? "" : "s"} (skipped)
            </span>
          </p>
          <div className="max-h-[28rem] overflow-auto rounded-lg border bg-card">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-14">Row</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-28">Product</TableHead>
                  <TableHead className="w-72">Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {review.map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                    <TableCell className={cn("whitespace-normal", !r.input.title && "text-muted-foreground italic")}>{r.input.title || "(empty)"}</TableCell>
                    <TableCell>{r.input.product ? shortProduct(r.input.product) : "—"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {r.status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-4" /> Ready
                        </span>
                      )}
                      {r.status === "duplicate" && (
                        <span className="inline-flex items-start gap-1 text-[color-mix(in_oklch,var(--warning),var(--foreground)_35%)]">
                          <CircleAlert className="mt-0.5 size-4 shrink-0" /> Looks like {r.duplicateOf!.code}
                        </span>
                      )}
                      {r.status === "error" && (
                        <span className="inline-flex items-start gap-1 text-destructive">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {r.problems.join(". ")}
                        </span>
                      )}
                      {r.status !== "error" && r.problems.length > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{r.problems.join(". ")}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {dups.length > 0 && (
            <fieldset className="space-y-1.5 text-sm">
              <legend className="mb-1 font-medium">Possible duplicates</legend>
              {(["skip", "import"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="dups" checked={dupAction === v} onChange={() => setDupAction(v)} className="accent-(--primary)" />
                  {v === "skip" ? "Skip them (recommended)" : "Import them anyway"}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={importing}>
              Back
            </Button>
            <Button onClick={runImport} disabled={importing || toImport.length === 0}>
              {importing && <Loader2 className="animate-spin" />}
              Import {toImport.length} guide{toImport.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="max-w-xl rounded-lg border bg-card p-6">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">
            {result.imported} guide{result.imported === 1 ? "" : "s"} imported
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.skipped > 0 && `${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped. `}Imported guides are marked unverified so you can check them when you have time.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/guides?status=unverified">Review imported guides</ButtonLink>
            <Button variant="outline" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
