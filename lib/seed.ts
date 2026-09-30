import type { TablesInsert } from "@/lib/supabase/database.types";
import type { Analysis, Guide, ReleaseNote, Template } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis-schema";

/** Pure mapping from the sample data to database rows, so the seed can be unit-tested without a database. */

export function guideToRow(g: Guide): TablesInsert<"guides"> {
  return {
    title: g.title,
    product: g.product,
    version: g.version,
    module: g.module,
    category: g.category,
    symptom: g.symptom,
    error_message: g.errorMessage ?? null,
    cause: g.cause ?? null,
    steps: g.steps,
    prevention: g.prevention ?? null,
    tags: g.tags,
    verified: g.verified,
    uses: g.uses,
    created_at: g.createdAt,
  };
}

/** Rewrites sample guide numbers (e.g. G-1042) to the numbers the database assigned. */
export function remapGuideRefs(result: AnalysisResult, codeMap: Map<string, string>): AnalysisResult {
  return {
    ...result,
    sources: result.sources.map((s) => {
      if (s.kind !== "my-guide") return s;
      const code = codeMap.get(s.ref) ?? s.ref;
      return { ...s, ref: code, label: s.label.replace(s.ref, code) };
    }),
  };
}

export function analysisToRow(a: Analysis, codeMap: Map<string, string>): TablesInsert<"analyses"> {
  const { understanding, assumptions, treatment, entries, steps, tax, mistakes, verifyReports, needsVerification, judgementNote, sources } = a;
  const result = remapGuideRefs({ understanding, assumptions, treatment, entries, steps, tax, mistakes, verifyReports, needsVerification, judgementNote, sources }, codeMap);
  return { title: a.title, scenario: a.scenario, result, confidence: a.confidence, model: "sample", created_at: a.createdAt };
}

export function templateToRow(t: Template): TablesInsert<"templates"> {
  return { kind: t.kind, title: t.title, body: t.body, tags: t.tags, uses: t.uses };
}

export function releaseNoteToRow(r: ReleaseNote): TablesInsert<"release_notes"> {
  return { product: r.product, version: r.version, type: r.type, title: r.title, detail: r.detail };
}
