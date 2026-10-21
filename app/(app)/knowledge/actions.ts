"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { articleInputSchema, hasNewerVersion, starterToRow, type ArticleInput } from "@/lib/knowledge/model";
import { STARTER_ARTICLES } from "@/lib/knowledge/starter";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";

/** Knowledge hub. Every call runs as the signed-in user, so Row Level Security applies. */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ArticleInput, string>> };

const idSchema = z.uuid();
const SESSION_ENDED = "Your session has ended. Please sign in again.";
const GONE = "This article no longer exists.";

async function session() {
  return (await getUser()) ? await createClient() : null;
}

function refresh(id?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/knowledge");
  if (id) revalidatePath(`/knowledge/${id}`);
}

function parse(input: unknown) {
  const parsed = articleInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data } as const;
  const fieldErrors: Partial<Record<keyof ArticleInput, string>> = {};
  for (const i of parsed.error.issues) {
    const k = i.path[0] as keyof ArticleInput;
    if (k && !fieldErrors[k]) fieldErrors[k] = i.message;
  }
  return { error: { ok: false as const, error: "A few fields need attention.", fieldErrors } };
}

function toColumns(a: ArticleInput) {
  return {
    title: a.title,
    category: a.category,
    tell_customer: a.tellCustomer,
    what_it_is: a.whatItIs,
    example: a.example,
    desktop_steps: a.desktopSteps,
    cloud_steps: a.cloudSteps,
    mistakes: a.mistakes,
    related: a.related,
    sources: a.sources as unknown as Json,
  };
}

/** Copies the ticked starter articles in. Unknown slugs and ones the user already has (even in the bin) are skipped. */
export async function addStarterArticles(slugs: string[]): Promise<Result<{ added: number }>> {
  const wanted = z.array(z.string().max(100)).max(200).safeParse(slugs);
  if (!wanted.success) return { ok: false, error: "Choose which articles to add." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data: had, error: hadError } = await sb.from("knowledge_articles").select("starter_slug").not("starter_slug", "is", null);
  if (hadError) return { ok: false, error: "Couldn’t add the articles. Please try again." };
  const have = new Set(had.map((r) => r.starter_slug));
  const rows = STARTER_ARTICLES.filter((s) => wanted.data.includes(s.slug) && !have.has(s.slug)).map((s) => ({ ...starterToRow(s), sources: s.sources as unknown as Json }));
  if (!rows.length) return { ok: true, data: { added: 0 } };
  const { error } = await sb.from("knowledge_articles").insert(rows);
  if (error) return { ok: false, error: "Couldn’t add the articles. Please try again." };
  refresh();
  return { ok: true, data: { added: rows.length } };
}

export async function createArticle(input: unknown): Promise<Result<{ id: string }>> {
  const p = parse(input);
  if (p.error) return p.error;
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("knowledge_articles").insert(toColumns(p.data)).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn’t save the article. Please try again." };
  refresh();
  return { ok: true, data };
}

async function update(id: string, columns: TablesUpdate<"knowledge_articles">, failure: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("knowledge_articles").update(columns).eq("id", id).is("deleted_at", null).select("id");
  if (error) return { ok: false, error: failure };
  if (!data.length) return { ok: false, error: GONE };
  refresh(id);
  return { ok: true, data: undefined };
}

/** Saves the user's changes. A starter copy becomes "edited", so newer starter text is never offered for it. */
export async function updateArticle(id: string, input: unknown): Promise<Result> {
  const p = parse(input);
  if (p.error) return p.error;
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data: row } = await sb.from("knowledge_articles").select("starter_slug").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!row) return { ok: false, error: GONE };
  return update(id, { ...toColumns(p.data), edited: row.starter_slug !== null }, "Couldn’t save the article. Please try again.");
}

export async function setArticleReviewed(id: string, reviewed: boolean): Promise<Result> {
  return update(id, { reviewed: !!reviewed }, "Couldn’t update the article. Please try again.");
}

export async function setStepsVerified(id: string, verified: boolean): Promise<Result> {
  return update(id, { steps_verified: !!verified }, "Couldn’t update the article. Please try again.");
}

export async function deleteArticle(id: string): Promise<Result> {
  return update(id, { deleted_at: new Date().toISOString() }, "Couldn’t delete the article. Please try again.");
}

export async function restoreArticle(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("knowledge_articles").update({ deleted_at: null }).eq("id", id).not("deleted_at", "is", null).select("id");
  if (error) return { ok: false, error: "Couldn’t restore the article. Please try again." };
  if (!data.length) return { ok: false, error: "This article was permanently removed." };
  refresh(id);
  return { ok: true, data: undefined };
}

/** Replaces an unedited starter copy with the newer starter text. It needs reviewing again afterwards. */
export async function updateFromStarter(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data: row } = await sb.from("knowledge_articles").select("starter_slug, starter_version, edited").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!row) return { ok: false, error: GONE };
  const current = { starterSlug: row.starter_slug, starterVersion: row.starter_version, edited: row.edited };
  if (!hasNewerVersion(current, STARTER_ARTICLES)) return { ok: false, error: "There’s no newer version of this article to update to." };
  const starter = STARTER_ARTICLES.find((s) => s.slug === row.starter_slug)!;
  return update(id, { ...starterToRow(starter), sources: starter.sources as unknown as Json }, "Couldn’t update the article. Please try again.");
}
