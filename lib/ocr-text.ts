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

/** The readable lines of OCR output, tidied: stray marks from icons and window borders dropped. */
function readableLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => (line.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= MIN_READABLE);
}

/** Cuts text to `max` characters at a whole word. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).trim();
}

/** Turns the text read from a screenshot into one search: readable lines joined, cut at a whole word. */
export function ocrTextToQuery(raw: string): string {
  return cutAtWord(readableLines(raw).join(" "), QUERY_MAX);
}

/** The text read from a screenshot as lines, for a chat question or a guide's error message; whole lines up to `max`. */
export function ocrTextToLines(raw: string, max: number): string {
  const kept: string[] = [];
  let length = 0;
  for (const line of readableLines(raw)) {
    const next = length + (kept.length ? 1 : 0) + line.length;
    if (next > max) {
      if (!kept.length) kept.push(cutAtWord(line, max));
      break;
    }
    kept.push(line);
    length = next;
  }
  return kept.join("\n");
}

/** Adds read text after what's already in a field, on a new line, without going past the field's limit. */
export function appendText(current: string, added: string, max: number): string {
  const base = current.trim() ? `${current.trimEnd()}\n` : "";
  return (base + added).slice(0, max);
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
