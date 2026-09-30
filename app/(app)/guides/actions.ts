"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { describeChanges, guideInputSchema, inputToRow, type GuideInput } from "@/lib/guide-schema";
import type { Json } from "@/lib/supabase/database.types";

/** Server actions for the guide library. Every call runs as the signed-in user, so RLS applies. */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Partial<Record<keyof GuideInput, string>> };

const BUCKET = "attachments";
const codeSchema = z.string().regex(/^G-\d{1,9}$/, "Not a valid guide number.");

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function fieldErrors(err: z.ZodError): Partial<Record<keyof GuideInput, string>> {
  const out: Partial<Record<keyof GuideInput, string>> = {};
  for (const issue of err.issues) {
    const key = issue.path[0] as keyof GuideInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

async function session() {
  const user = await getUser();
  if (!user) return null;
  return { user, supabase: await createClient() };
}

async function findGuide(code: string) {
  const s = await session();
  if (!s) return { s: null, guide: null } as const;
  const { data } = await s.supabase.from("guides").select("*").eq("code", code).maybeSingle();
  return { s, guide: data } as const;
}

function refresh(code?: string) {
  revalidatePath("/", "layout");
  if (code) revalidatePath(`/guides/${code}`);
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

export async function createGuide(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  const parsed = guideInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A few fields need attention.", fieldErrors: fieldErrors(parsed.error) };
  const s = await session();
  if (!s) return fail("Your session has ended. Please sign in again.");

  const { data, error } = await s.supabase.from("guides").insert(inputToRow(parsed.data)).select("id, code").single();
  if (error || !data) return fail("Couldn’t save the guide. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: data.id, summary: "Guide created" });
  refresh(data.code);
  return { ok: true, data };
}

export async function updateGuide(code: string, input: unknown): Promise<ActionResult<{ code: string }>> {
  if (!codeSchema.safeParse(code).success) return fail("Not a valid guide number.");
  const parsed = guideInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A few fields need attention.", fieldErrors: fieldErrors(parsed.error) };
  const { s, guide } = await findGuide(code);
  if (!s) return fail("Your session has ended. Please sign in again.");
  if (!guide || guide.deleted_at) return fail("This guide no longer exists.");

  const before: GuideInput = {
    title: guide.title,
    product: guide.product as GuideInput["product"],
    version: guide.version,
    module: guide.module,
    category: guide.category as GuideInput["category"],
    symptom: guide.symptom,
    errorMessage: guide.error_message ?? "",
    cause: guide.cause ?? "",
    steps: guide.steps,
    prevention: guide.prevention ?? "",
    tags: guide.tags,
  };
  const summary = describeChanges(before, parsed.data);
  if (!summary) return { ok: true, data: { code } };

  const { error } = await s.supabase.from("guides").update(inputToRow(parsed.data)).eq("id", guide.id);
  if (error) return fail("Couldn’t save your changes. Please try again.");
  // The snapshot keeps the previous version so an edit can be traced or undone by hand.
  await s.supabase.from("guide_revisions").insert({ guide_id: guide.id, summary, snapshot: before as unknown as Json });
  refresh(code);
  return { ok: true, data: { code } };
}

export async function setVerified(code: string, verified: boolean): Promise<ActionResult> {
  const { s, guide } = await findGuide(code);
  if (!s) return fail("Your session has ended. Please sign in again.");
  if (!guide || guide.deleted_at) return fail("This guide no longer exists.");
  if (guide.verified === verified) return { ok: true, data: undefined };
  const { error } = await s.supabase.from("guides").update({ verified }).eq("id", guide.id);
  if (error) return fail("Couldn’t update the guide. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: guide.id, summary: verified ? "Marked as verified" : "Marked as unverified" });
  refresh(code);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Delete / restore (soft delete; kept 30 days in the bin)
// ---------------------------------------------------------------------------

export async function deleteGuide(code: string): Promise<ActionResult> {
  const { s, guide } = await findGuide(code);
  if (!s) return fail("Your session has ended. Please sign in again.");
  if (!guide) return fail("This guide no longer exists.");
  if (guide.deleted_at) return { ok: true, data: undefined };
  const { error } = await s.supabase.from("guides").update({ deleted_at: new Date().toISOString() }).eq("id", guide.id);
  if (error) return fail("Couldn’t delete the guide. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: guide.id, summary: "Moved to the bin" });
  refresh(code);
  return { ok: true, data: undefined };
}

export async function restoreGuide(code: string): Promise<ActionResult> {
  const { s, guide } = await findGuide(code);
  if (!s) return fail("Your session has ended. Please sign in again.");
  if (!guide) return fail("This guide was permanently removed.");
  if (!guide.deleted_at) return { ok: true, data: undefined };
  const { error } = await s.supabase.from("guides").update({ deleted_at: null }).eq("id", guide.id);
  if (error) return fail("Couldn’t restore the guide. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: guide.id, summary: "Restored from the bin" });
  refresh(code);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Duplicates and usage
// ---------------------------------------------------------------------------

export async function findSimilarGuides(title: string, errorMessage = "", excludeCode?: string): Promise<{ code: string; title: string }[]> {
  if (title.trim().length < 4) return [];
  const s = await session();
  if (!s) return [];
  const { data } = await s.supabase.rpc("similar_guides", { p_title: title.slice(0, 300), p_error: errorMessage.slice(0, 1000), p_limit: 3 });
  return (data ?? []).filter((r) => r.code !== excludeCode && r.score >= 0.35).map(({ code, title }) => ({ code, title }));
}

// ---------------------------------------------------------------------------
// Attachments (files are uploaded by the browser straight to private storage under <user>/<guide>/)
// ---------------------------------------------------------------------------

const attachmentSchema = z.object({
  path: z.string().min(3).max(500),
  name: z.string().min(1).max(200),
  kind: z.enum(["image", "pdf", "sql"]),
  sizeBytes: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

export async function addAttachment(code: string, file: unknown): Promise<ActionResult> {
  const parsed = attachmentSchema.safeParse(file);
  if (!parsed.success) return fail("That file couldn’t be attached.");
  const { s, guide } = await findGuide(code);
  if (!s) return fail("Your session has ended. Please sign in again.");
  if (!guide || guide.deleted_at) return fail("This guide no longer exists.");
  // The file must sit in this user's folder for this guide; storage RLS enforces the user part too.
  if (!parsed.data.path.startsWith(`${s.user.id}/${guide.id}/`)) return fail("That file couldn’t be attached.");
  const { error } = await s.supabase.from("guide_attachments").insert({
    guide_id: guide.id,
    storage_path: parsed.data.path,
    name: parsed.data.name,
    kind: parsed.data.kind,
    size_bytes: parsed.data.sizeBytes,
  });
  if (error) return fail("The file uploaded but couldn’t be linked to the guide. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: guide.id, summary: `Attached ${parsed.data.name}` });
  refresh(code);
  return { ok: true, data: undefined };
}

export async function removeAttachment(attachmentId: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session has ended. Please sign in again.");
  const { data: att } = await s.supabase.from("guide_attachments").select("id, guide_id, storage_path, name, guides(code)").eq("id", attachmentId).maybeSingle();
  if (!att) return fail("That attachment no longer exists.");
  await s.supabase.storage.from(BUCKET).remove([att.storage_path]);
  const { error } = await s.supabase.from("guide_attachments").delete().eq("id", att.id);
  if (error) return fail("Couldn’t remove the attachment. Please try again.");
  await s.supabase.from("guide_revisions").insert({ guide_id: att.guide_id, summary: `Removed ${att.name}` });
  refresh(att.guides?.code);
  return { ok: true, data: undefined };
}

/** A private link to one attachment, valid for 10 minutes. */
export async function attachmentUrl(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  const s = await session();
  if (!s) return fail("Your session has ended. Please sign in again.");
  const { data: att } = await s.supabase.from("guide_attachments").select("storage_path, name").eq("id", attachmentId).maybeSingle();
  if (!att) return fail("That attachment no longer exists.");
  const { data, error } = await s.supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 600);
  if (error || !data) return fail("Couldn’t open the file. Please try again.");
  return { ok: true, data: { url: data.signedUrl } };
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export async function importGuides(rows: unknown, fileName: string): Promise<ActionResult<{ imported: number }>> {
  const list = z.array(z.unknown()).max(5000, "Import up to 5,000 rows at a time.").safeParse(rows);
  if (!list.success) return fail(list.error.issues[0].message);
  const valid = list.data.map((r) => guideInputSchema.safeParse(r)).flatMap((r) => (r.success ? [r.data] : []));
  if (valid.length !== list.data.length) return fail("Some rows are no longer valid. Go back and review them.");
  if (!valid.length) return fail("There are no rows to import.");
  const s = await session();
  if (!s) return fail("Your session has ended. Please sign in again.");

  const name = fileName.slice(0, 120);
  let imported = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const chunk = valid.slice(i, i + 500);
    const { data, error } = await s.supabase.from("guides").insert(chunk.map(inputToRow)).select("id");
    if (error || !data) {
      if (imported) refresh();
      return fail(imported ? `Imported ${imported} guides, then the rest failed. Import the remaining rows again.` : "Couldn’t import the guides. Please try again.");
    }
    await s.supabase.from("guide_revisions").insert(data.map((g) => ({ guide_id: g.id, summary: `Imported from ${name}` })));
    imported += data.length;
  }
  refresh();
  return { ok: true, data: { imported } };
}
