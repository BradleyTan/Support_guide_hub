"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { askErrorMessage, type ChatTurn, type WebSearchStatus } from "@/lib/accountant/chat";
import type { CheckedAnswer } from "@/lib/accountant/core/answer";
import type { MaskMap } from "@/lib/accountant/core/mask";

export type AskResult = { ok: true; checked: CheckedAnswer; mask: MaskMap; web: WebSearchStatus } | { ok: false; error: string };

/**
 * Calls the ask-accountant Edge Function straight from the browser (Netlify's free functions would time out).
 * Everything sent is already masked; the map goes along so the function reuses the same placeholders.
 * forceWeb: also search the web for this question ("Search the web too").
 */
export async function askAccountant(body: { message: string; history: ChatTurn[]; mask: MaskMap; forceWeb?: boolean }): Promise<AskResult> {
  try {
    const { data, error } = await supabaseBrowser().functions.invoke<{ checked: CheckedAnswer; mask: MaskMap; web?: WebSearchStatus }>("ask-accountant", { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        const payload = await res.json().catch(() => null);
        return { ok: false, error: askErrorMessage(res.status, payload) };
      }
      return { ok: false, error: askErrorMessage(0, null) };
    }
    if (!data?.checked) return { ok: false, error: askErrorMessage(502, { error: "bad_answer" }) };
    return { ok: true, checked: data.checked, mask: data.mask ?? body.mask, web: data.web ?? "off" };
  } catch {
    return { ok: false, error: askErrorMessage(0, null) };
  }
}
