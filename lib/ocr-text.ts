import { MAX_FILE_MB } from "@/lib/files";

/** Screenshot search: the pure parts (no browser engine), so they can be unit-tested. */

export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Long enough for a full error message; longer text makes a worse search. */
export const QUERY_MAX = 300;
/** A line needs at least this many letters or digits, otherwise it's stray marks from icons and borders. */
const MIN_READABLE = 2;

/** Checks a pasted or chosen screenshot. Returns an error message or null. */
export function validateScreenshot(f: { type: string; size: number }): string | null {
  if (!SCREENSHOT_TYPES.includes(f.type)) return "Use a PNG, JPG or WEBP image.";
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `That image is over ${MAX_FILE_MB} MB. Crop it to the error message and try again.`;
  return null;
}

/** Turns the text read from a screenshot into one search: readable lines joined, cut at a whole word. */
export function ocrTextToQuery(raw: string): string {
  const text = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => (line.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= MIN_READABLE)
    .join(" ");
  if (text.length <= QUERY_MAX) return text;
  const cut = text.slice(0, QUERY_MAX + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).trim();
}

type ClipboardEntry = { kind: string; type: string; getAsFile: () => File | null };

/** The image in a paste, if there is one. Pasted text and other files return null, so normal pasting still works. */
export function imageFromClipboard(items: Iterable<ClipboardEntry> | ArrayLike<ClipboardEntry> | null | undefined): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file" && SCREENSHOT_TYPES.includes(item.type)) return item.getAsFile();
  }
  return null;
}
