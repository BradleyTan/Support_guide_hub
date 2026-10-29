"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/team";
import { OWNER_ONLY_ERROR } from "@/lib/team-rules";

/** Owner only: deletes the whole team's logged searches. Guide-open history is kept. */
export async function clearSearchHistory(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: OWNER_ONLY_ERROR };
  const { error } = await supabase.from("search_log").delete().gt("id", 0);
  if (error) return { ok: false, error: "Couldn’t clear your search history. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
