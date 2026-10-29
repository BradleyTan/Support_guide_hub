"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/team";
import { MEMBER_ONLY_ERROR } from "@/lib/team-rules";
import { chatTitle, readAnswer, turnRows } from "@/lib/accountant/chat";

/** Accountant chat. Every call runs as the signed-in user, so Row Level Security applies. */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.uuid();
const maskSchema = z.record(z.string().regex(/^\[(COMPANY|IC|BANK|PHONE|EMAIL|HIDDEN) \d+\]$/), z.string().max(300)).refine((m) => Object.keys(m).length <= 1000);
const SESSION_ENDED = MEMBER_ONLY_ERROR;
const GONE = "This chat no longer exists.";

async function session() {
  return await requireMember();
}

function refresh(id?: string) {
  revalidatePath("/chat");
  if (id) revalidatePath(`/chat/${id}`);
}

/**
 * Saves one question and its checked answer (already unmasked in the browser). Starts a new chat when chatId is
 * null, titled from the question. The chat's placeholder map is kept so follow-ups reuse the same placeholders.
 */
export async function saveTurn(input: { chatId: string | null; userText: string; answer: unknown; mask: Record<string, string> }): Promise<Result<{ chatId: string; assistantMessageId: string }>> {
  const text = z.string().trim().min(1).max(4000).safeParse(input.userText);
  const answer = readAnswer(input.answer);
  const mask = maskSchema.safeParse(input.mask);
  if (!text.success || !answer || !mask.success || (input.chatId !== null && !idSchema.safeParse(input.chatId).success)) return { ok: false, error: "That answer couldn’t be saved." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };

  let chatId = input.chatId;
  const isNew = !chatId;
  if (chatId) {
    const { data, error } = await sb.from("accountant_chats").update({ mask_map: mask.data }).eq("id", chatId).is("deleted_at", null).select("id").maybeSingle();
    if (error) return { ok: false, error: "Couldn’t save the answer. Please try again." };
    if (!data) return { ok: false, error: GONE };
  } else {
    const { data, error } = await sb.from("accountant_chats").insert({ title: chatTitle(text.data), mask_map: mask.data }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn’t save the answer. Please try again." };
    chatId = data.id;
  }

  // Question and answer in one insert, so a turn is saved whole or not at all (getChat lists the question first).
  const { data: saved, error } = await sb
    .from("accountant_messages")
    .insert(turnRows(chatId, text.data, answer))
    .select("id, role");
  const answerRow = saved?.find((m) => m.role === "assistant");
  if (error || !answerRow) {
    // A chat created just now for this turn would otherwise be left empty.
    if (isNew) await sb.from("accountant_chats").delete().eq("id", chatId);
    return { ok: false, error: "Couldn’t save the answer. Please try again." };
  }
  refresh(chatId);
  return { ok: true, data: { chatId, assistantMessageId: answerRow.id } };
}

/** The "I've checked the entry and steps" tick that unlocks Copy for the customer. */
export async function setAnswerChecked(messageId: string, checked: boolean): Promise<Result> {
  if (!idSchema.safeParse(messageId).success) return { ok: false, error: "Not a valid answer." };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("accountant_messages").update({ checked: checked === true }).eq("id", messageId).eq("role", "assistant").select("chat_id").maybeSingle();
  if (error) return { ok: false, error: "Couldn’t save the tick. Please try again." };
  if (!data) return { ok: false, error: GONE };
  refresh(data.chat_id);
  return { ok: true, data: undefined };
}

export async function renameChat(id: string, title: string): Promise<Result> {
  const t = z.string().trim().min(1, "Give the chat a name.").max(200).safeParse(title);
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  if (!t.success) return { ok: false, error: t.error.issues[0].message };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("accountant_chats").update({ title: t.data }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
  if (error) return { ok: false, error: "Couldn’t rename the chat. Please try again." };
  if (!data) return { ok: false, error: GONE };
  refresh(id);
  return { ok: true, data: undefined };
}

/** Moves a chat to the bin (emptied automatically after 30 days). */
export async function deleteChat(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("accountant_chats").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null).select("id").maybeSingle();
  if (error) return { ok: false, error: "Couldn’t delete the chat. Please try again." };
  if (!data) return { ok: false, error: GONE };
  refresh(id);
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

export async function restoreChat(id: string): Promise<Result> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: GONE };
  const sb = await session();
  if (!sb) return { ok: false, error: SESSION_ENDED };
  const { data, error } = await sb.from("accountant_chats").update({ deleted_at: null }).eq("id", id).not("deleted_at", "is", null).select("id").maybeSingle();
  if (error) return { ok: false, error: "Couldn’t restore the chat. Please try again." };
  if (!data) return { ok: false, error: GONE };
  refresh(id);
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}
