import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { analysisResultSchema } from "@/lib/analysis-schema";
import type { Analysis, Attachment, Category, Confidence, Guide, Product, ReleaseNote, Template, TemplateKind } from "@/lib/types";
import { ACTIVITY_DAYS, libraryHealth, notOpenedRecently, type Insights, type OpenedGuide, type SearchGap } from "@/lib/insights";

/** Server-side reads. Every query runs as the signed-in user, so RLS limits results to their own rows. */

export function rowToGuide(r: Tables<"guides">, extra?: { attachments?: Attachment[]; revisions?: Guide["revisions"] }): Guide {
  return {
    id: r.code,
    dbId: r.id,
    deletedAt: r.deleted_at ?? undefined,
    title: r.title,
    product: r.product as Product,
    version: r.version,
    module: r.module,
    category: r.category as Category | null,
    symptom: r.symptom,
    errorMessage: r.error_message ?? undefined,
    cause: r.cause ?? undefined,
    steps: r.steps,
    prevention: r.prevention ?? undefined,
    tags: r.tags,
    verified: r.verified,
    uses: r.uses,
    attachments: extra?.attachments ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revisions: extra?.revisions ?? [],
  };
}

const GUIDE_COLUMNS =
  "id, user_id, code, title, product, version, module, category, symptom, error_message, cause, steps, prevention, tags, verified, uses, created_at, updated_at, deleted_at";

type GuideRow = Omit<Tables<"guides">, "embedding" | "fts">;
const asRow = (r: GuideRow) => ({ ...r, embedding: null, fts: null }) as Tables<"guides">;

export const getGuides = cache(async (): Promise<Guide[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("guides").select(GUIDE_COLUMNS).is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw new Error(`Couldn’t load guides: ${error.message}`);
  return (data as GuideRow[]).map((r) => rowToGuide(asRow(r)));
});

export const getGuide = cache(async (code: string): Promise<Guide | null> => {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("guides").select(GUIDE_COLUMNS).eq("code", code).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`Couldn’t load guide: ${error.message}`);
  if (!row) return null;
  const r = row as GuideRow;
  const [att, rev, pins] = await Promise.all([
    supabase.from("guide_attachments").select("id, name, kind, size_bytes").eq("guide_id", r.id).order("created_at"),
    supabase.from("guide_revisions").select("created_at, summary").eq("guide_id", r.id).order("created_at"),
    supabase.from("pins").select("id, title, url, site").eq("guide_id", r.id).order("created_at"),
  ]);
  return {
    ...rowToGuide(asRow(r), {
      attachments: (att.data ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind as Attachment["kind"], sizeKb: Math.round(a.size_bytes / 1024) })),
      revisions: (rev.data ?? []).map((v) => ({ at: v.created_at, summary: v.summary })),
    }),
    pins: pins.data ?? [],
  };
});

/** Guides in the bin (soft-deleted in the last 30 days), newest first. */
export const getDeletedGuides = cache(async (): Promise<Guide[]> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_COLUMNS)
    .not("deleted_at", "is", null)
    .gte("deleted_at", since)
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(`Couldn’t load the bin: ${error.message}`);
  return (data as GuideRow[]).map((r) => rowToGuide(asRow(r)));
});

export const getAnalyses = cache(async (): Promise<Analysis[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, code, title, scenario, result, confidence, created_at, analysis_messages(role, text, created_at)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn’t load analyses: ${error.message}`);
  return data.flatMap((a) => {
    const parsed = analysisResultSchema.safeParse(a.result);
    if (!parsed.success) return []; // A malformed row is skipped rather than breaking the screen.
    const chat = [...(a.analysis_messages ?? [])]
      .sort((x, y) => x.created_at.localeCompare(y.created_at))
      .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));
    return [{ id: a.code, title: a.title, scenario: a.scenario, createdAt: a.created_at, confidence: a.confidence as Confidence, chat, ...parsed.data }];
  });
});

export const getTemplates = cache(async (): Promise<Template[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("templates").select("id, kind, title, body, tags, uses").is("deleted_at", null).order("uses", { ascending: false });
  if (error) throw new Error(`Couldn’t load templates: ${error.message}`);
  return data.map((t) => ({ ...t, kind: t.kind as TemplateKind }));
});

export const getReleaseNotes = cache(async (): Promise<ReleaseNote[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_notes")
    .select("id, product, version, type, title, detail, release_note_guides(guides(code))")
    .is("deleted_at", null)
    .order("version", { ascending: false });
  if (error) throw new Error(`Couldn’t load release notes: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    product: r.product as Product,
    version: r.version,
    type: r.type as ReleaseNote["type"],
    title: r.title,
    detail: r.detail,
    guideIds: (r.release_note_guides ?? []).flatMap((l) => (l.guides ? [l.guides.code] : [])),
  }));
});

/** Guides opened in the activity window, most opened first (deleted guides left out). */
export const getOpenedGuides = cache(async (): Promise<OpenedGuide[]> => {
  const supabase = await createClient();
  const [guides, { data, error }] = await Promise.all([getGuides(), supabase.rpc("top_guides", { p_days: ACTIVITY_DAYS, p_limit: 1000 })]);
  if (error) throw new Error(`Couldn’t load guide activity: ${error.message}`);
  const byDbId = new Map(guides.map((g) => [g.dbId, g]));
  return data.flatMap((r) => {
    const guide = byDbId.get(r.guide_id);
    return guide ? [{ guide, opens: r.opens, lastOpened: r.last_opened }] : [];
  });
});

/**
 * Searches made at least twice in the activity window whose latest run matched none of your guides.
 * Each is re-checked (words and typos) so a guide written since then is pointed out.
 */
export const getSearchGaps = cache(async (): Promise<SearchGap[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_gaps", { p_days: ACTIVITY_DAYS, p_min_times: 2, p_limit: 20 });
  if (error) throw new Error(`Couldn’t load search gaps: ${error.message}`);
  return Promise.all(
    data.map(async (r) => {
      const gap: SearchGap = { query: r.query, times: r.times, lastSearched: r.last_searched };
      const { data: hit } = await supabase.rpc("search_guides", { p_query: r.query, p_embedding: null, p_limit: 1 });
      if (hit?.[0]) {
        const { data: g } = await supabase.from("guides").select("code, title").eq("id", hit[0].id).maybeSingle();
        if (g) gap.coveredBy = g;
      }
      return gap;
    }),
  );
});

export const getInsights = cache(async (): Promise<Insights> => {
  const supabase = await createClient();
  const [guides, opened, gaps, { data: weeks, error }] = await Promise.all([
    getGuides(),
    getOpenedGuides(),
    getSearchGaps(),
    supabase.rpc("weekly_activity", { p_weeks: 12 }),
  ]);
  if (error) throw new Error(`Couldn’t load weekly activity: ${error.message}`);
  return {
    weeks: weeks.map((w) => ({ weekStart: w.week_start, opens: w.opens, searches: w.searches, unmatched: w.unmatched, added: w.added, edited: w.edited })),
    gaps,
    topOpened: opened.slice(0, 10),
    notOpened: notOpenedRecently(guides, new Set(opened.map((o) => o.guide.dbId!))),
    health: libraryHealth(guides),
  };
});
