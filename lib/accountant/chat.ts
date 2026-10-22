import { modelAnswerSchema, type CheckedAnswer } from "@/lib/accountant/core/answer";
import { unmask, type MaskMap } from "@/lib/accountant/core/mask";

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
export function askErrorMessage(status: number, body: unknown): string {
  const b = (body && typeof body === "object" ? body : {}) as { error?: string; retryAfter?: number };
  if (status === 429) return `Groq's free limit is busy — try again in ${Math.max(1, Math.round(Number(b.retryAfter) || 60))} seconds`;
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 503 || b.error === "not_configured") return "The Groq key isn't set up yet. Add GROQ_API_KEY under Supabase → Edge Functions → Secrets (see docs/GO-LIVE.md).";
  if (b.error === "bad_answer") return "The answer came back in a form that couldn't be checked. Please try again.";
  if (b.error === "mask_too_large") return "This chat has too many hidden names and numbers to continue. Please start a new chat.";
  if (status === 400) return "Write the scenario in up to 4,000 characters.";
  return "Couldn't get an answer just now. Please try again.";
}
