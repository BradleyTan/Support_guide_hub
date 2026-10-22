import { modelAnswerSchema, type CheckedAnswer } from "@/lib/accountant/core/answer";

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
