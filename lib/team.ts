import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient, getUser } from "@/lib/supabase/server";
import { canUseApp, isOwner, type Membership } from "@/lib/team-rules";

export type { Membership };

/** The caller's team_members row (RLS lets a user read their own), or null. Cached per request. */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("role, status, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { role: data.role, status: data.status, displayName: data.display_name };
});

/** For Server Actions: the signed-in client when the caller is an approved member, otherwise null. */
export async function requireMember(): Promise<SupabaseClient<Database> | null> {
  return canUseApp(await getMembership()) ? await createClient() : null;
}

/** For Server Actions: the signed-in client when the caller is an approved owner, otherwise null. */
export async function requireOwner(): Promise<SupabaseClient<Database> | null> {
  return isOwner(await getMembership()) ? await createClient() : null;
}
