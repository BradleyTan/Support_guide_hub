"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

/** Deletes all of your logged searches (RLS: only your own rows). Guide-open history is kept. */
export async function clearSearchHistory(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getUser())) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error } = await (await createClient()).from("search_log").delete().gt("id", 0);
  if (error) return { ok: false, error: "Couldn’t clear your search history. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
