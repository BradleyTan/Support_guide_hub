"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { embedGuides } from "@/lib/embeddings";
import { createClient, getUser } from "@/lib/supabase/server";
import { guides } from "@/lib/mock/guides";
import { analyses } from "@/lib/mock/analyses";
import { templates } from "@/lib/mock/library";
import { analysisToRow, guideToRow, templateToRow } from "@/lib/seed";

export type SeedResult = { ok: true; guides: number } | { ok: false; error: string };

/** Copies the sample guides, analyses and templates into the signed-in user's account. */
export async function loadSampleData(): Promise<SeedResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();

  const { count } = await supabase.from("guides").select("id", { count: "exact", head: true });
  if (count) return { ok: false, error: "You already have guides, so sample data wasn’t added." };

  // Insert oldest first so newer sample guides get higher numbers.
  const ordered = [...guides].sort((a, b) => a.id.localeCompare(b.id));
  const { data: inserted, error: gErr } = await supabase.from("guides").insert(ordered.map(guideToRow)).select("id, code, title");
  if (gErr || !inserted) return { ok: false, error: "Couldn’t add the sample guides. Please try again." };

  // Match by title (unique in the sample set); bulk-insert return order isn't guaranteed.
  const byTitle = new Map(inserted.map((r) => [r.title, r]));
  const codeMap = new Map(ordered.map((g) => [g.id, byTitle.get(g.title)!.code]));
  const idMap = new Map(ordered.map((g) => [g.id, byTitle.get(g.title)!.id]));

  const revisions = ordered.flatMap((g) => g.revisions.map((r) => ({ guide_id: idMap.get(g.id)!, summary: r.summary, created_at: r.at })));
  const { data: anRows, error: aErr } = await supabase.from("analyses").insert([...analyses].reverse().map((a) => analysisToRow(a, codeMap))).select("id, title");
  const results = await Promise.all([
    supabase.from("guide_revisions").insert(revisions),
    supabase.from("templates").insert(templates.map(templateToRow)),
  ]);
  if (aErr || results.some((r) => r.error)) return { ok: false, error: "Some sample data couldn’t be added. Please try again." };

  const messages = analyses.flatMap((a) => {
    const row = anRows?.find((r) => r.title === a.title);
    return row ? a.chat.map((m, i) => ({ analysis_id: row.id, role: m.role, text: m.text, created_at: new Date(Date.parse(a.createdAt) + (i + 1) * 60_000).toISOString() })) : [];
  });
  const { error: mErr } = messages.length ? await supabase.from("analysis_messages").insert(messages) : { error: null };
  if (mErr) return { ok: false, error: "Some sample data couldn’t be added. Please try again." };

  after(() => embedGuides(supabase, inserted.map((g) => g.id)));
  revalidatePath("/", "layout");
  return { ok: true, guides: inserted.length };
}
