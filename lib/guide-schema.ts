import { z } from "zod";
import { CATEGORIES, PRODUCTS, type Guide } from "@/lib/types";

/** Splits a multi-line or comma list into trimmed, non-empty items. */
export function splitLines(s: string) {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

export function splitTags(s: string) {
  return [
    ...new Set(
      s
        .split(/[,;\n]/)
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

/** What the guide form (and the importer) submits. Shared by client and server. */
export const guideInputSchema = z.object({
  title: z.string().trim().min(1, "Give the guide a title so you can find it later.").max(300, "Keep the title under 300 characters."),
  product: z.enum(PRODUCTS, { error: "Choose the product this applies to." }),
  version: text(100).default(""),
  module: text(100).default(""),
  category: z.enum(CATEGORIES).nullable().default(null),
  symptom: text(4000).default(""),
  errorMessage: text(4000).default(""),
  cause: text(4000).default(""),
  steps: z.array(z.string().trim().min(1).max(2000)).min(1, "Add at least one fix step.").max(50, "Keep it to 50 steps or fewer."),
  prevention: text(2000).default(""),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export type GuideInput = z.infer<typeof guideInputSchema>;

/** Converts validated input to database columns (empty optional text becomes null). */
export function inputToRow(g: GuideInput) {
  return {
    title: g.title,
    product: g.product,
    version: g.version,
    module: g.module,
    category: g.category,
    symptom: g.symptom,
    error_message: g.errorMessage || null,
    cause: g.cause || null,
    steps: g.steps,
    prevention: g.prevention || null,
    tags: g.tags,
  };
}

export function guideToInput(g: Guide): GuideInput {
  return {
    title: g.title,
    product: g.product,
    version: g.version,
    module: g.module,
    category: g.category,
    symptom: g.symptom,
    errorMessage: g.errorMessage ?? "",
    cause: g.cause ?? "",
    steps: g.steps,
    prevention: g.prevention ?? "",
    tags: g.tags,
  };
}

const FIELD_LABELS: Record<keyof GuideInput, string> = {
  title: "title",
  product: "product",
  version: "versions",
  module: "module",
  category: "category",
  symptom: "symptom",
  errorMessage: "error message",
  cause: "cause",
  steps: "fix steps",
  prevention: "prevention",
  tags: "tags",
};

/** Human summary of what changed between two versions, for the edit history. */
export function describeChanges(before: GuideInput, after: GuideInput) {
  const changed = (Object.keys(FIELD_LABELS) as (keyof GuideInput)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (!changed.length) return null;
  const names = changed.map((k) => FIELD_LABELS[k]);
  return `Edited ${names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ")}`;
}
