import { z } from "zod";
import type { Guide } from "@/lib/types";

/** Pure helpers for saved SOPs (no browser or database access). */

export interface SopStep {
  text: string;
  /** A screenshot from the linked guide's attachments, shown under the step. */
  attachmentId: string | null;
}

export interface Sop {
  id: string; // SOP-1, SOP-2 …
  dbId: string;
  guideCode: string | null;
  title: string;
  version: string;
  purpose: string;
  scope: string;
  steps: SopStep[];
  checks: string[];
  updatedAt: string;
}

/** A screenshot that can be placed under a step; url is a short-lived private link (10 minutes). */
export interface SopImage {
  id: string;
  name: string;
  url: string | null;
}

export const sopStepSchema = z.object({
  text: z.string().trim().min(1, "A step can’t be empty.").max(2000, "Keep each step under 2,000 characters."),
  attachmentId: z.uuid().nullable().default(null),
});

export const sopInputSchema = z.object({
  guideCode: z
    .string()
    .regex(/^G-\d{1,9}$/)
    .nullable()
    .default(null),
  title: z.string().trim().min(1, "Give the SOP a title.").max(300, "Keep the title under 300 characters."),
  version: z.string().trim().max(100, "Keep the version under 100 characters.").default(""),
  purpose: z.string().trim().max(2000, "Keep the purpose under 2,000 characters.").default(""),
  scope: z.string().trim().max(2000, "Keep the scope under 2,000 characters.").default(""),
  steps: z.array(sopStepSchema).min(1, "Add at least one step.").max(50, "Keep it to 50 steps or fewer."),
  checks: z.array(z.string().trim().min(1).max(500)).max(30, "Keep it to 30 checks or fewer.").default([]),
});
export type SopInput = z.infer<typeof sopInputSchema>;

/** Steps stored in the database, read defensively (anything malformed is dropped). */
export function parseSteps(json: unknown): SopStep[] {
  const parsed = z.array(sopStepSchema).safeParse(json);
  if (parsed.success) return parsed.data;
  return Array.isArray(json) ? json.flatMap((s) => (sopStepSchema.safeParse(s).success ? [sopStepSchema.parse(s)] : [])) : [];
}

/** First draft of an SOP from a guide: its fix steps, and its product, version and module as the scope. */
export function sopFromGuide(g: Guide): SopInput {
  return {
    guideCode: g.id,
    title: `SOP: ${g.title}`.slice(0, 300),
    version: g.version,
    purpose: `How to resolve: ${g.title}`.slice(0, 2000),
    scope: [g.product + (g.version ? ` ${g.version}` : ""), g.module].filter(Boolean).join(", "),
    steps: g.steps.filter((s) => s.trim()).map((text) => ({ text: text.trim().slice(0, 2000), attachmentId: null })),
    checks: g.prevention?.trim() ? [`Prevention: ${g.prevention.trim()}`.slice(0, 500)] : [],
  };
}

/** Moves item i by d places (−1 up, +1 down); out-of-range moves return the list unchanged. */
export function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
