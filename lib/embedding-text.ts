/** The text a guide is "understood" by for meaning-based search: what it's about, not how to fix it. */
export function guideEmbeddingText(g: { title: string; product?: string; module?: string; symptom?: string | null; error_message?: string | null; cause?: string | null; tags?: string[] }) {
  return [g.title, g.product && g.module ? `${g.product} ${g.module}` : g.product ?? g.module, g.error_message, g.symptom, g.cause, g.tags?.length ? g.tags.join(" ") : ""]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

/** pgvector text format: "[0.1,0.2,…]". */
export function toVectorLiteral(values: number[]) {
  if (!values.length || values.some((v) => !Number.isFinite(v))) throw new Error("Invalid embedding");
  return `[${values.join(",")}]`;
}
