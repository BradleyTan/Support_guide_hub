"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { getAnalyses, getArticles, getGuides, getSops, getTemplates } from "@/lib/data";
import { analysesSheet, guidesSheet, knowledgeSheet, sopsSheet, templatesSheet, type Sheet } from "@/lib/export";

/** Everything you've saved (not the bin), as sheets for one Excel file. Runs as you, so RLS applies. */
export async function exportEverything(): Promise<{ ok: true; sheets: Sheet[] } | { ok: false; error: string }> {
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  try {
    const [guides, analyses, templates, sops, articles] = await Promise.all([getGuides(), getAnalyses(), getTemplates(), getSops(), getArticles()]);
    return { ok: true, sheets: [guidesSheet(guides), analysesSheet(analyses), sopsSheet(sops), templatesSheet(templates), knowledgeSheet(articles)] };
  } catch {
    return { ok: false, error: "Couldn’t gather your data. Please try again." };
  }
}

const chatSettingsSchema = z.object({
  model: z.string().trim().regex(/^[\w./-]{1,100}$/, "Use the model name exactly as Groq lists it, e.g. openai/gpt-oss-120b."),
  webSearch: z.boolean(),
});

/** Accountant chat: which Groq model answers, and whether the optional web-search step may run. */
export async function saveChatSettings(input: { model: string; webSearch: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = chatSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const user = await getUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, chat_model: parsed.data.model, chat_web_search: parsed.data.webSearch }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Couldn’t save the chat settings. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}
