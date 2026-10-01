import { z } from "zod";
import { PRODUCTS } from "@/lib/types";

/** Validation for your own version notes (no browser or database access). */

export const RELEASE_NOTE_TYPES = ["Known issue", "Fix", "Note"] as const;

export const releaseNoteInputSchema = z.object({
  product: z.enum(PRODUCTS, { error: "Choose the product." }),
  version: z.string().trim().min(1, "Enter the AutoCount version, e.g. 2.2.").max(50, "Keep the version under 50 characters."),
  type: z.enum(RELEASE_NOTE_TYPES),
  title: z.string().trim().min(1, "Give the note a title.").max(300, "Keep the title under 300 characters."),
  detail: z.string().trim().max(4000, "Keep the detail under 4,000 characters.").default(""),
  guideCodes: z
    .array(z.string().regex(/^G-\d{1,9}$/))
    .max(20, "Link up to 20 guides.")
    .default([]),
});
export type ReleaseNoteInput = z.infer<typeof releaseNoteInputSchema>;

/**
 * Sorts versions newest first, comparing number by number ("2.10" after "2.9"), with text after numbers.
 * Used to order the version groups on the page.
 */
export function compareVersionsDesc(a: string, b: string) {
  const pa = a.split(/[.\s-]+/);
  const pb = b.split(/[.\s-]+/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "";
    const y = pb[i] ?? "";
    const nx = /^\d+$/.test(x) ? Number(x) : NaN;
    const ny = /^\d+$/.test(y) ? Number(y) : NaN;
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return ny - nx;
    } else if (x !== y) return y.localeCompare(x);
  }
  return 0;
}
