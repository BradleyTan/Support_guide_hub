"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { requireMember, requireOwner } from "@/lib/team";
import { MEMBER_ONLY_ERROR, OWNER_ONLY_ERROR } from "@/lib/team-rules";
import { getAnalyses, getArticles, getGuides, getSops, getTemplates } from "@/lib/data";
import { analysesSheet, guidesSheet, knowledgeSheet, sopsSheet, templatesSheet, type Sheet } from "@/lib/export";

/** Everything you've saved (not the bin), as sheets for one Excel file. Runs as you, so RLS applies. */
export async function exportEverything(): Promise<{ ok: true; sheets: Sheet[] } | { ok: false; error: string }> {
  if (!(await requireOwner())) return { ok: false, error: OWNER_ONLY_ERROR };
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
  const supabase = await requireOwner();
  const user = supabase ? await getUser() : null;
  if (!supabase || !user) return { ok: false, error: OWNER_ONLY_ERROR };
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, chat_model: parsed.data.model, chat_web_search: parsed.data.webSearch }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Couldn’t save the chat settings. Please try again." };
  revalidatePath("/settings");
  return { ok: true };
}

const displayNameSchema = z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer for your name.");

/** Your name as teammates see it ("Last edited by", edit history, the Team page). */
export async function saveDisplayName(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await requireMember();
  if (!supabase) return { ok: false, error: MEMBER_ONLY_ERROR };
  const { error } = await supabase.rpc("set_my_display_name", { p_name: parsed.data });
  if (error) return { ok: false, error: "Couldn’t save your name. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
