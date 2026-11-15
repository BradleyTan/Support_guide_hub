import { guideInputSchema, type GuideInput } from "@/lib/guide-schema";
import { PLATFORM_LABELS } from "@/lib/types";

/**
 * Edit history: what each edit changed, and which earlier versions can be restored. Each edit's revision row keeps
 * the guide as it was just before that edit (its snapshot), so an edit's "after" is the next edit's snapshot, or the
 * guide as it is now for the latest edit.
 */

const LABELS: [keyof GuideInput, string][] = [
  ["title", "Title"],
  ["product", "Product"],
  ["platform", "Platform"],
  ["version", "Versions"],
  ["module", "Module"],
  ["category", "Category"],
  ["symptom", "Symptom"],
  ["errorMessage", "Error message"],
  ["cause", "Cause"],
  ["steps", "Fix steps"],
  ["prevention", "Prevention"],
  ["tags", "Tags"],
];

export type FieldChange = { field: string; before: string; after: string };

function shown(key: keyof GuideInput, value: GuideInput[keyof GuideInput]): string {
  if (key === "steps") return (value as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n");
  if (key === "tags") return (value as string[]).join(", ");
  if (key === "platform") return PLATFORM_LABELS[value as GuideInput["platform"]] ?? String(value);
  return value == null ? "" : String(value);
}

/** The fields that differ between two versions, in form order, as readable text. */
export function fieldChanges(before: GuideInput, after: GuideInput): FieldChange[] {
  return LABELS.filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(([k, field]) => ({ field, before: shown(k, before[k]), after: shown(k, after[k]) }));
}

type RevisionRow = { id: string; at: string; summary: string; snapshot: unknown };
export type RevisionWithChanges<R extends RevisionRow> = Omit<R, "snapshot"> & { changes?: FieldChange[]; restorable: boolean };

/** A saved snapshot as a guide version, or null when it's missing or no longer fits the form (e.g. an old product). */
export function snapshotVersion(snapshot: unknown): GuideInput | null {
  if (!snapshot) return null;
  const parsed = guideInputSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : null;
}

/** Adds each edit's changes and whether its "before" version can be restored. Revisions must be oldest first. */
export function withChanges<R extends RevisionRow>(revisions: R[], current: GuideInput): RevisionWithChanges<R>[] {
  const versions = revisions.map((r) => snapshotVersion(r.snapshot));
  return revisions.map((r, i) => {
    const rest = { ...r } as Omit<R, "snapshot"> & { snapshot?: unknown };
    delete rest.snapshot;
    const before = versions[i];
    if (!before) return { ...rest, restorable: false };
    const nextIndex = r.snapshot ? revisions.findIndex((later, j) => j > i && later.snapshot) : -1;
    const after = nextIndex === -1 ? current : versions[nextIndex];
    const changes = after ? fieldChanges(before, after) : undefined;
    return { ...rest, changes: changes?.length ? changes : undefined, restorable: true };
  });
}
