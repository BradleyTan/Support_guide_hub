"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { templateInputSchema } from "@/lib/templates";

/** Templates & snippets. Every call runs as the signed-in user, so RLS applies. */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Partial<Record<"kind" | "title" | "body" | "tags", string>> };

const idSchema = z.uuid();
const SESSION_ENDED = "Your session has ended. Please sign in again.";

async function session() {
  return (await getUser()) ? await createClient() : null;
}

function refresh() {
  revalidatePath("/templates");
  revalidatePath("/replies");
}

function parse(input: unknown) {
  const parsed = templateInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors: Partial<Record<"kind" | "title" | "body" | "tags", string>> = {};
  for (const i of parsed.error.issues) {
    const k = i.path[0] as keyof typeof fieldErrors;
    if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
  }
  return { error: { ok: false as const, error: "A few fields need attention.", fieldErrors } };
}

export async function createTemplate(input: unknown): Promise<Result<{ id: string }>> {
  const p = parse(input);
  if (p.error) return p.error;
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("templates").insert(p.data).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn’t save the template. Please try again." };
  refresh();
  return { ok: true, data };
}

export async function updateTemplate(id: string, input: unknown): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "This template no longer exists." };
  const p = parse(input);
  if (p.error) return p.error;
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("templates").update(p.data).eq("id", id).is("deleted_at", null).select("id");
  if (error) return { ok: false, error: "Couldn’t save the template. Please try again." };
  if (!data.length) return { ok: false, error: "This template no longer exists." };
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteTemplate(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "This template no longer exists." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { error } = await sb.from("templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "Couldn’t delete the template. Please try again." };
  refresh();
  return { ok: true, data: undefined };
}

/** Counts a copy or a reply made with the template ("used n×"). Best effort. */
export async function countTemplateUse(id: string): Promise<void> {
  if (!idSchema.safeParse(id).success) return;
  const sb = await session();
  if (!sb) return;
  const { data } = await sb.from("templates").select("uses").eq("id", id).maybeSingle();
  if (data) await sb.from("templates").update({ uses: data.uses + 1 }).eq("id", id);
}
