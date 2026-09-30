import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { guideEmbeddingText, toVectorLiteral } from "@/lib/embedding-text";

type Client = SupabaseClient<Database>;
const DIMENSIONS = 384;
const BATCH = 32;

/** Vectors for up to 64 texts from the `embed` Edge Function (Supabase's gte-small), called as the signed-in user. */
export async function embedTexts(supabase: Client, texts: string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke<{ embeddings: number[][] }>("embed", { body: { texts } });
  if (error || !data?.embeddings || data.embeddings.length !== texts.length || data.embeddings.some((e) => e.length !== DIMENSIONS)) {
    throw new Error(`Embedding failed${error ? `: ${error.message}` : ""}`);
  }
  return data.embeddings;
}

/** Vector literal for a search query, or null if the embedding service is unavailable (search then uses words only). */
export async function embedQuery(supabase: Client, query: string) {
  try {
    const [v] = await embedTexts(supabase, [query.slice(0, 1000)]);
    return toVectorLiteral(v);
  } catch (e) {
    console.error("[search] query embedding unavailable", e);
    return null;
  }
}

/**
 * (Re)computes vectors for the given guides. Best effort: a failure is logged and never blocks saving;
 * missing vectors are filled in later by `backfillEmbeddings`.
 */
export async function embedGuides(supabase: Client, ids: string[]) {
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    try {
      const { data } = await supabase.from("guides").select("id, title, product, module, symptom, error_message, cause, tags").in("id", chunk);
      if (!data?.length) continue;
      const vectors = await embedTexts(supabase, data.map(guideEmbeddingText));
      await Promise.all(data.map((g, j) => supabase.from("guides").update({ embedding: toVectorLiteral(vectors[j]) }).eq("id", g.id)));
    } catch (e) {
      console.error("[embeddings] could not embed guides", e);
      return;
    }
  }
}

/** Fills in vectors for guides that don't have one yet (e.g. saved while the service was down). */
export async function backfillEmbeddings(supabase: Client, limit = 64) {
  const { data } = await supabase.from("guides").select("id").is("embedding", null).is("deleted_at", null).limit(limit);
  if (data?.length) await embedGuides(supabase, data.map((g) => g.id));
}
