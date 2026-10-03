"use server";

import { getUser } from "@/lib/supabase/server";
import { getAnalyses, getGuides, getSops, getTemplates } from "@/lib/data";
import { analysesSheet, guidesSheet, sopsSheet, templatesSheet, type Sheet } from "@/lib/export";

/** Everything you've saved (not the bin), as sheets for one Excel file. Runs as you, so RLS applies. */
export async function exportEverything(): Promise<{ ok: true; sheets: Sheet[] } | { ok: false; error: string }> {
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  try {
    const [guides, analyses, templates, sops] = await Promise.all([getGuides(), getAnalyses(), getTemplates(), getSops()]);
    return { ok: true, sheets: [guidesSheet(guides), analysesSheet(analyses), sopsSheet(sops), templatesSheet(templates)] };
  } catch {
    return { ok: false, error: "Couldn’t gather your data. Please try again." };
  }
}
