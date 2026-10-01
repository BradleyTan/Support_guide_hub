"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { releaseNoteInputSchema, type ReleaseNoteInput } from "@/lib/release-notes";

/** Your version notes. Every call runs as the signed-in user, so RLS applies. */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ReleaseNoteInput, string>> };

const idSchema = z.uuid();
const SESSION_ENDED = "Your session has ended. Please sign in again.";
type Client = Awaited<ReturnType<typeof createClient>>;

async function session() {
  return (await getUser()) ? await createClient() : null;
}

function parse(input: unknown) {
  const parsed = releaseNoteInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors: Partial<Record<keyof ReleaseNoteInput, string>> = {};
  for (const i of parsed.error.issues) {
    const k = i.path[0] as keyof ReleaseNoteInput;
    if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
  }
  return { error: { ok: false as const, error: "A few fields need attention.", fieldErrors } };
}

/** Replaces the note's linked guides with the given ones (only your own, non-deleted guides). */
async function linkGuides(sb: Client, noteId: string, codes: string[]): Promise<string | null> {
  const unique = [...new Set(codes)];
  const { data: guides } = unique.length ? await sb.from("guides").select("id").in("code", unique).is("deleted_at", null) : { data: [] };
  if ((guides ?? []).length !== unique.length) return "A linked guide no longer exists. Check the linked guides and save again.";
  const { error: delError } = await sb.from("release_note_guides").delete().eq("release_note_id", noteId);
  if (delError) return "Couldn’t update the linked guides. Please try again.";
  if (guides?.length) {
    const { error } = await sb.from("release_note_guides").insert(guides.map((g) => ({ release_note_id: noteId, guide_id: g.id })));
    if (error) return "Couldn’t update the linked guides. Please try again.";
  }
  return null;
}

function refresh() {
  revalidatePath("/releases");
  revalidatePath("/guides", "layout");
}

export async function createReleaseNote(input: unknown): Promise<Result<{ id: string }>> {
  const p = parse(input);
  if (p.error) return p.error;
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { guideCodes, ...row } = p.data;
  const { data, error } = await sb.from("release_notes").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn’t save the note. Please try again." };
  const linkError = await linkGuides(sb, data.id, guideCodes);
  refresh();
  if (linkError) return { ok: false, error: `The note was saved, but: ${linkError}` };
  return { ok: true, data };
}

export async function updateReleaseNote(id: string, input: unknown): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "This note no longer exists." };
  const p = parse(input);
  if (p.error) return p.error;
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { guideCodes, ...row } = p.data;
  const { data, error } = await sb.from("release_notes").update(row).eq("id", id).is("deleted_at", null).select("id");
  if (error) return { ok: false, error: "Couldn’t save the note. Please try again." };
  if (!data.length) return { ok: false, error: "This note no longer exists." };
  const linkError = await linkGuides(sb, id, guideCodes);
  refresh();
  if (linkError) return { ok: false, error: linkError };
  return { ok: true, data: undefined };
}

export async function deleteReleaseNote(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "This note no longer exists." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { error } = await sb.from("release_notes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "Couldn’t delete the note. Please try again." };
  refresh();
  return { ok: true, data: undefined };
}
