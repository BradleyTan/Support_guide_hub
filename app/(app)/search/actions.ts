"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { after } from "next/server";
import { MIN_MEANING_SIMILARITY, backfillEmbeddings, embedQuery } from "@/lib/embeddings";
import { isAllowedUrl, siteLabel, type OfficialHit } from "@/lib/official-sites";
import { rowToGuide } from "@/lib/data";
import { PRODUCTS, type Guide } from "@/lib/types";
import type { Tables } from "@/lib/supabase/database.types";

export type MatchSource = "words" | "fuzzy" | "meaning";
export type GuideHit = Guide & { matchedBy: MatchSource[] };

const filtersSchema = z.object({
  product: z.enum(PRODUCTS).nullable().default(null),
  module: z.string().trim().max(100).nullable().default(null),
  version: z.string().trim().max(50).nullable().default(null),
  tag: z.string().trim().max(50).nullable().default(null),
  updatedWithinDays: z.number().int().positive().max(3650).nullable().default(null),
});
export type SearchFilters = z.input<typeof filtersSchema>;

const querySchema = z.string().trim().min(1).max(1000);

/** Your guides for a query: words + typos + meaning, merged and ranked in the database (RLS applies). */
export async function searchMyGuides(
  query: string,
  filters: SearchFilters = {},
  /** false when called while rendering a page: after() there can't read the session cookie. */
  backfill = true,
): Promise<{ ok: true; hits: GuideHit[]; meaningUsed: boolean } | { ok: false; error: string }> {
  const q = querySchema.safeParse(query);
  if (!q.success) return { ok: true, hits: [], meaningUsed: false };
  const f = filtersSchema.safeParse(filters);
  if (!f.success) return { ok: false, error: "Those filters aren’t valid." };
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  const supabase = await createClient();

  const embedding = await embedQuery(supabase, q.data);
  // Guides saved while the vector service was down get their vectors now, without slowing this search.
  if (embedding && backfill) after(() => backfillEmbeddings(supabase));
  const { data: ranked, error } = await supabase.rpc("search_guides", {
    p_query: q.data,
    p_embedding: embedding,
    p_product: f.data.product,
    p_module: f.data.module || null,
    p_version: f.data.version || null,
    p_tag: f.data.tag?.toLowerCase() || null,
    p_updated_after: f.data.updatedWithinDays ? new Date(Date.now() - f.data.updatedWithinDays * 86_400_000).toISOString() : null,
    p_min_similarity: MIN_MEANING_SIMILARITY,
    p_limit: 20,
  });
  if (error) return { ok: false, error: "Search didn’t finish. Please try again." };
  // Feeds Insights → search gaps. Filtered searches aren't logged: no match there doesn't mean no guide exists.
  // Best effort: a logging failure never affects the search.
  const filtered = Object.values(f.data).some((v) => v !== null && v !== "");
  if (!filtered) {
    const { error: logError } = await supabase.rpc("log_search", { p_query: q.data, p_guide_hits: ranked?.length ?? 0 });
    if (logError) console.error("[search] could not log search", logError.message);
  }
  if (!ranked?.length) return { ok: true, hits: [], meaningUsed: !!embedding };

  const { data: rows } = await supabase
    .from("guides")
    .select("id, user_id, code, title, product, version, module, category, symptom, error_message, cause, steps, prevention, tags, verified, uses, created_at, updated_at, deleted_at")
    .in("id", ranked.map((r) => r.id));
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const hits = ranked.flatMap((r) => {
    const row = byId.get(r.id);
    return row ? [{ ...rowToGuide({ ...row, embedding: null, fts: null } as Tables<"guides">), matchedBy: r.matched_by as MatchSource[] }] : [];
  });
  return { ok: true, hits, meaningUsed: !!embedding };
}

export type OfficialResult = { status: "ok"; results: OfficialHit[]; indexed: number } | { status: "error"; reason: string };

/** Official help-centre articles for a query, from the daily-refreshed index (same words/typos/meaning search). */
export async function searchOfficialSources(query: string): Promise<OfficialResult> {
  const q = querySchema.safeParse(query);
  if (!q.success) return { status: "error", reason: "Type something to search for." };
  if (!(await getUser())) return { status: "error", reason: "Your session has ended. Please sign in again." };
  const supabase = await createClient();
  const embedding = await embedQuery(supabase, q.data);
  const [{ data, error }, { count }] = await Promise.all([
    supabase.rpc("search_official_pages", { p_query: q.data, p_embedding: embedding, p_min_similarity: MIN_MEANING_SIMILARITY, p_limit: 10 }),
    supabase.from("official_pages").select("url", { count: "exact", head: true }),
  ]);
  if (error) return { status: "error", reason: "Official search didn’t finish. Please try again." };
  return {
    status: "ok",
    indexed: count ?? 0,
    results: (data ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.snippet, site: r.site, lastmod: r.lastmod, matchedBy: r.matched_by })),
  };
}

const pinSchema = z.object({ code: z.string().regex(/^G-\d{1,9}$/), title: z.string().trim().min(1).max(300), url: z.string().url().max(2000) });

/** Saves an official page to a guide's "Pinned official sources". Only official-site links are accepted. */
export async function pinToGuide(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = pinSchema.safeParse(input);
  if (!p.success || !isAllowedUrl(p.data.url) || !p.data.url.startsWith("https://")) return { ok: false, error: "Only https links on the official AutoCount sites can be pinned." };
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  const supabase = await createClient();
  const { data: guide } = await supabase.from("guides").select("id").eq("code", p.data.code).is("deleted_at", null).maybeSingle();
  if (!guide) return { ok: false, error: "That guide no longer exists." };
  const { error } = await supabase.from("pins").upsert({ guide_id: guide.id, title: p.data.title, url: p.data.url, site: siteLabel(p.data.url) }, { onConflict: "guide_id,url", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Couldn’t pin that page. Please try again." };
  revalidatePath(`/guides/${p.data.code}`);
  return { ok: true };
}

export async function unpin(pinId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(pinId).success) return { ok: false, error: "That pin no longer exists." };
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pins").delete().eq("id", pinId).select("guides(code)").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn’t remove the pin. Please try again." };
  if (data.guides?.code) revalidatePath(`/guides/${data.guides.code}`);
  return { ok: true };
}
