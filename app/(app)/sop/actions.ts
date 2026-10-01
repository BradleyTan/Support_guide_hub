"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { sopInputSchema, type SopInput } from "@/lib/sop";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

/** Saved SOPs. Every call runs as the signed-in user, so RLS applies. */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Partial<Record<keyof SopInput, string>> };

const codeSchema = z.string().regex(/^SOP-\d{1,9}$/);
const SESSION_ENDED = "Your session has ended. Please sign in again.";

async function session() {
  return (await getUser()) ? await createClient() : null;
}

/** Validates the input and turns it into table columns: the guide code becomes its id, and screenshots must belong to that guide. */
async function toRow(sb: Awaited<ReturnType<typeof createClient>>, input: unknown): Promise<Result<TablesInsert<"sops">>> {
  const parsed = sopInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof SopInput, string>> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] as keyof SopInput;
      if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
    }
    return { ok: false, error: "A few fields need attention.", fieldErrors };
  }
  const s = parsed.data;
  let guideId: string | null = null;
  if (s.guideCode) {
    const { data: g } = await sb.from("guides").select("id").eq("code", s.guideCode).maybeSingle();
    if (!g) return { ok: false, error: `Guide ${s.guideCode} no longer exists.` };
    guideId = g.id;
  }
  const wanted = [...new Set(s.steps.flatMap((st) => (st.attachmentId ? [st.attachmentId] : [])))];
  if (wanted.length) {
    if (!guideId) return { ok: false, error: "Screenshots can only come from the linked guide." };
    const { data: atts } = await sb.from("guide_attachments").select("id").eq("guide_id", guideId).eq("kind", "image").in("id", wanted);
    if ((atts ?? []).length !== wanted.length) return { ok: false, error: "A screenshot is no longer attached to the guide. Choose it again." };
  }
  return {
    ok: true,
    data: { guide_id: guideId, title: s.title, version: s.version, purpose: s.purpose, scope: s.scope, steps: s.steps as unknown as Json, checks: s.checks },
  };
}

function refresh(code?: string) {
  revalidatePath("/sop");
  if (code) revalidatePath(`/sop/${code}`);
}

export async function createSop(input: unknown): Promise<Result<{ code: string }>> {
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const row = await toRow(sb, input);
  if (!row.ok) return row;
  const { data, error } = await sb.from("sops").insert(row.data).select("code").single();
  if (error || !data) return { ok: false, error: "Couldn’t save the SOP. Please try again." };
  refresh();
  return { ok: true, data };
}

export async function updateSop(code: string, input: unknown): Promise<Result> {
  if (!codeSchema.safeParse(code).success) return { ok: false, error: "This SOP no longer exists." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const row = await toRow(sb, input);
  if (!row.ok) return row;
  const { data, error } = await sb.from("sops").update(row.data).eq("code", code).is("deleted_at", null).select("code");
  if (error) return { ok: false, error: "Couldn’t save the SOP. Please try again." };
  if (!data.length) return { ok: false, error: "This SOP no longer exists." };
  refresh(code);
  return { ok: true, data: undefined };
}

export async function deleteSop(code: string): Promise<Result> {
  if (!codeSchema.safeParse(code).success) return { ok: false, error: "This SOP no longer exists." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { error } = await sb.from("sops").update({ deleted_at: new Date().toISOString() }).eq("code", code);
  if (error) return { ok: false, error: "Couldn’t delete the SOP. Please try again." };
  refresh(code);
  return { ok: true, data: undefined };
}
