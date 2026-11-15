import { modelAnswerSchema, type CheckedAnswer } from "@/lib/accountant/core/answer";
import { unmask, type MaskMap } from "@/lib/accountant/core/mask";
import type { Json } from "@/lib/supabase/database.types";

/** Pure helpers for saved Accountant chats (no browser or database access, so they're unit-testable). */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer: CheckedAnswer | null;
  checked: boolean;
  createdAt: string;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function chatTitle(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 80) : "New chat";
}

/** A stored answer is used only if it still has the expected shape; otherwise the turn shows without it. */
export function readAnswer(value: unknown): CheckedAnswer | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<CheckedAnswer>;
  if (!modelAnswerSchema.safeParse(v.answer).success || !Array.isArray(v.entryResults) || !Array.isArray(v.steps) || !Array.isArray(v.sources)) return null;
  return { flags: [], customerReply: null, ...v } as CheckedAnswer;
}

export function rowToMessage(r: { id: string; role: string; content: string; answer: unknown; checked: boolean; created_at: string }): ChatMessage {
  return { id: r.id, role: r.role === "assistant" ? "assistant" : "user", content: r.content, answer: readAnswer(r.answer), checked: r.checked, createdAt: r.created_at };
}

/** The last 6 turns, as text Groq can follow. Answers are cut down to what was said, not the whole JSON. */
export function historyForGroq(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-6).map((m): ChatTurn => {
    if (m.role === "user" || !m.answer) return { role: m.role, content: m.content };
    const a = m.answer.answer;
    const parts = a.needsMoreInfo ? ["I asked:", ...a.questions.map((q) => `- ${q}`)] : [a.summary, m.answer.customerReply ?? ""];
    return { role: "assistant", content: parts.filter(Boolean).join("\n").slice(0, 4000) };
  });
}

/** Swaps placeholders back to real names in every text of an answer (the browser does this; Groq never sees them). */
export function unmaskAnswer(checked: CheckedAnswer, map: MaskMap): CheckedAnswer {
  return JSON.parse(JSON.stringify(checked), (_key, value) => (typeof value === "string" ? unmask(value, map) : value));
}

/** What to tell the user when ask-accountant fails. Their typed message always stays in the box. */
/** "about 8 minutes", "about 2 hours", or "later today" when Groq gave no time. */
function waitText(seconds: number | undefined): string {
  const s = Number(seconds);
  if (!s || s <= 0) return "later today";
  const minutes = Math.max(1, Math.ceil(s / 60));
  if (minutes < 90) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `in about ${Math.ceil(minutes / 60)} hours`;
}

export function askErrorMessage(status: number, body: unknown): string {
  const b = (body && typeof body === "object" ? body : {}) as { error?: string; retryAfter?: number };
  // Named errors first: the status alone can mean several things (503 is both "no key" and "Groq is down").
  switch (b.error) {
    case "daily_limit":
      return `Today’s free Groq allowance is used up. Try again ${waitText(b.retryAfter)}.`;
    case "groq_down":
      return "Groq (the AI service) isn’t working right now. Try again in a few minutes.";
    case "groq_timeout":
      return "Groq took too long to answer. Try again, or shorten the scenario.";
    case "too_long":
      return "This chat is too long for the free model. Start a new chat and paste in just the scenario.";
    case "offline":
      return "Couldn’t reach the chatbot. Check your internet connection and try again.";
  }
  if (status === 429) return `Groq's free limit is busy — try again in ${Math.max(1, Math.round(Number(b.retryAfter) || 60))} seconds`;
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403 && b.error === "not_approved") return "Your account isn’t approved to use the chatbot.";
  if (b.error === "not_configured") return "The Groq key isn't set up yet. Add GROQ_API_KEY under Supabase → Edge Functions → Secrets (see docs/GO-LIVE.md).";
  if (b.error === "bad_answer") return "The answer came back in a form that couldn't be checked. Please try again.";
  if (status >= 500 && !b.error) return "The chatbot service isn’t responding right now. Try again in a few minutes.";
  if (b.error === "mask_too_large") return "This chat has too many hidden names and numbers to continue. Please start a new chat.";
  if (status === 400) return "Write the scenario in up to 4,000 characters.";
  return "Couldn't get an answer just now. Please try again.";
}

/**
 * The question and answer rows for one turn, saved in a single insert. Both list every column: in a multi-row
 * insert a column one row leaves out is sent as null, not as its default.
 */
export function turnRows(chatId: string, question: string, answer: CheckedAnswer) {
  return [
    { chat_id: chatId, role: "user", content: question, answer: null },
    { chat_id: chatId, role: "assistant", content: "", answer: answer as unknown as Json },
  ];
}

/** The question an answer replied to, and the turns before it, so it can be asked again (e.g. with web search). */
export function questionFor(messages: ChatMessage[], answerId: string): { question: string; earlier: ChatMessage[] } | null {
  const at = messages.findIndex((m) => m.id === answerId);
  for (let i = at - 1; i >= 0; i--) if (messages[i].role === "user") return { question: messages[i].content, earlier: messages.slice(0, i) };
  return null;
}

/** "used": a Web source was added; "failed": Groq refused or errored; "off": not asked for. */
export type WebSearchStatus = "used" | "failed" | "off";

export function webSearchNote(status: WebSearchStatus): string | null {
  return status === "failed" ? "Web search didn't work — Groq's free plan may not include it. This answer uses your own sources only." : null;
}
