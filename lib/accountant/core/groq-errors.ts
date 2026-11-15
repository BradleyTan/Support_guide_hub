/**
 * Groq failures, sorted into what the person asking can act on. Shared with the ask-accountant Edge Function
 * (run `npm run sync:core` after changing this file).
 */

/**
 * Answers when the main model's free daily allowance is used up. Same family as the default model, with its own
 * daily allowance on Groq's free plan and strict JSON output, so answers keep the same shape and checks.
 */
export const BACKUP_MODEL = "openai/gpt-oss-20b";

export type GroqFailure = "daily_limit" | "rate_limited" | "not_configured" | "too_long" | "groq_down" | "groq_timeout" | "groq_error";

/** Status 504 is used for "Groq took too long" (our own timeout). */
export function classifyGroqFailure(status: number, detail: string): GroqFailure {
  if (status === 429) return /per day|\((?:TPD|RPD)\)/i.test(detail) ? "daily_limit" : "rate_limited";
  if (status === 401 || status === 403) return "not_configured";
  if (status === 413 || /context length|too large|reduce the length/i.test(detail)) return "too_long";
  if (status === 504) return "groq_timeout";
  if (status >= 500) return "groq_down";
  return "groq_error";
}

/** The model to try once the given one has used up today's allowance, or null if there's none left to try. */
export function backupFor(model: string): string | null {
  return model === BACKUP_MODEL ? null : BACKUP_MODEL;
}
