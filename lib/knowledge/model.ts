import { z } from "zod";

/** Knowledge hub articles: types, validation and pure helpers (no browser or database access). */

export const KNOWLEDGE_CATEGORIES = ["Basics", "Customers (AR)", "Suppliers (AP)", "Bank & cash", "Stock", "Reports", "Tax", "Period-end"] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export type Source = { label: string; url: string };

/** A starter article as written in lib/knowledge/starter/. The version goes up whenever its text is corrected. */
export interface StarterArticle {
  slug: string;
  version: number;
  title: string;
  category: KnowledgeCategory;
  /** 2–3 plain sentences the user can say or paste to a client. */
  tellCustomer: string;
  whatItIs: string;
  example: string;
  /** Menu path in desktop AutoCount Accounting; null when no source gives one. */
  desktopSteps: string | null;
  /** Menu path in AutoCount Cloud Accounting; null when no source gives one. */
  cloudSteps: string | null;
  mistakes: string[];
  /** Slugs of related starter articles. */
  related: string[];
  sources: Source[];
}

/** The user's own copy of an article (from a starter, or written by them). */
export interface KnowledgeArticle extends Omit<StarterArticle, "slug" | "version"> {
  id: string;
  starterSlug: string | null;
  starterVersion: number | null;
  /** The user changed a starter article, so newer starter text is never offered for it. */
  edited: boolean;
  reviewed: boolean;
  /** The user has confirmed the AutoCount menu paths. */
  stepsVerified: boolean;
  updatedAt: string;
  deletedAt?: string;
}

/** Shown instead of an empty box when no source gives a menu path. */
export const NOT_FOUND_STEPS = "Not found in a source yet — add it once checked";

const text = (max: number, label: string) => z.string().trim().max(max, `Keep ${label} under ${max.toLocaleString()} characters.`);
const steps = z
  .string()
  .trim()
  .max(2000, "Keep the steps under 2,000 characters.")
  .nullable()
  .transform((v) => (v ? v : null));

export const articleInputSchema = z.object({
  title: z.string().trim().min(1, "Give the article a title.").max(200, "Keep the title under 200 characters."),
  category: z.enum(KNOWLEDGE_CATEGORIES, { error: "Choose a category." }),
  tellCustomer: z.string().trim().min(1, "Write what to tell the customer.").max(1000, "Keep this under 1,000 characters."),
  whatItIs: text(4000, "this section").default(""),
  example: text(4000, "the example").default(""),
  desktopSteps: steps.default(null),
  cloudSteps: steps.default(null),
  mistakes: z.array(z.string().trim().min(1).max(500)).max(20, "Keep it to 20 mistakes or fewer.").default([]),
  related: z.array(z.string().trim().min(1).max(100)).max(10, "Link up to 10 related articles.").default([]),
  sources: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Give the source a name.").max(200),
        url: z
          .string()
          .trim()
          .url("Enter a full link.")
          .refine((u) => u.startsWith("https://"), "Links must start with https://"),
      }),
    )
    .max(10, "Keep it to 10 sources or fewer.")
    .default([]),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

/** Starter articles the user doesn't have. Articles in the bin count as had, so they aren't offered again. */
export function missingStarters(all: StarterArticle[], existingSlugs: string[]): StarterArticle[] {
  const have = new Set(existingSlugs);
  return all.filter((s) => !have.has(s.slug));
}

/** True when the starter text is newer than this copy and the user hasn't edited the copy. */
export function hasNewerVersion(a: Pick<KnowledgeArticle, "starterSlug" | "starterVersion" | "edited">, starters: StarterArticle[]): boolean {
  if (!a.starterSlug || a.edited || a.starterVersion === null) return false;
  const s = starters.find((x) => x.slug === a.starterSlug);
  return !!s && s.version > a.starterVersion;
}

/** The columns the app reads from public.knowledge_articles (user_id, fts and created_at aren't needed). */
export interface KnowledgeRow {
  id: string;
  starter_slug: string | null;
  starter_version: number | null;
  edited: boolean;
  title: string;
  category: string;
  tell_customer: string;
  what_it_is: string;
  example: string;
  desktop_steps: string | null;
  cloud_steps: string | null;
  steps_verified: boolean;
  mistakes: string[];
  related: string[];
  sources: unknown;
  reviewed: boolean;
  updated_at: string;
  deleted_at: string | null;
}

/** Content columns of a fresh, unreviewed copy of a starter article. */
export function starterToRow(s: StarterArticle) {
  return {
    starter_slug: s.slug,
    starter_version: s.version,
    edited: false,
    reviewed: false,
    steps_verified: false,
    title: s.title,
    category: s.category,
    tell_customer: s.tellCustomer,
    what_it_is: s.whatItIs,
    example: s.example,
    desktop_steps: s.desktopSteps,
    cloud_steps: s.cloudSteps,
    mistakes: s.mistakes,
    related: s.related,
    sources: s.sources,
  };
}

const sourceSchema = z.object({ label: z.string(), url: z.string() });

export function rowToArticle(r: KnowledgeRow): KnowledgeArticle {
  const sources = Array.isArray(r.sources) ? r.sources.flatMap((x) => (sourceSchema.safeParse(x).success ? [sourceSchema.parse(x)] : [])) : [];
  return {
    id: r.id,
    starterSlug: r.starter_slug,
    starterVersion: r.starter_version,
    edited: r.edited,
    reviewed: r.reviewed,
    stepsVerified: r.steps_verified,
    title: r.title,
    category: r.category as KnowledgeCategory,
    tellCustomer: r.tell_customer,
    whatItIs: r.what_it_is,
    example: r.example,
    desktopSteps: r.desktop_steps,
    cloudSteps: r.cloud_steps,
    mistakes: r.mistakes,
    related: r.related,
    sources,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? undefined,
  };
}

/** True when a Desktop or Cloud menu path was added, changed or removed: the "checked" mark must then be cleared. */
export function stepsChanged(prev: Pick<KnowledgeArticle, "desktopSteps" | "cloudSteps">, next: Pick<KnowledgeArticle, "desktopSteps" | "cloudSteps">) {
  return (prev.desktopSteps ?? null) !== (next.desktopSteps ?? null) || (prev.cloudSteps ?? null) !== (next.cloudSteps ?? null);
}
