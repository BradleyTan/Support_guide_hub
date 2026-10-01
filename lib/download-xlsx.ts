import { fitCell, type Sheet } from "@/lib/export";

/** Builds an .xlsx in the browser (SheetJS, loaded only when needed) and downloads it. Nothing is uploaded. */
export async function downloadXlsx(fileName: string, sheets: Sheet[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map(fitCell)));
    // Readable column widths: based on the longest first line in each column, capped.
    ws["!cols"] = (s.rows[0] ?? []).map((_, c) => ({
      wch: Math.min(60, Math.max(8, ...s.rows.map((r) => String(r[c] ?? "").split("\n")[0].length))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, fileName, { compression: true });
}
