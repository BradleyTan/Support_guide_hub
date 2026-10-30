"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/team";
import { OWNER_ONLY_ERROR } from "@/lib/team-rules";

/** Server actions for the Team page. Only the owner may call them; the database also enforces it. */

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid("Not a valid person.");
const OWNER_ROW_ERROR = "You can't change the owner.";

async function decide(userId: string, status: "approved" | "rejected" | "removed"): Promise<ActionResult> {
  const id = idSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: id.error.issues[0].message };
  const supabase = await requireOwner();
  if (!supabase) return { ok: false, error: OWNER_ONLY_ERROR };

  const { data: target } = await supabase.from("team_members").select("role").eq("user_id", id.data).maybeSingle();
  if (!target) return { ok: false, error: "That person wasn't found." };
  if (target.role === "owner") return { ok: false, error: OWNER_ROW_ERROR };

  // decided_at is set by the guard_team_members trigger; only status is writable.
  const { data, error } = await supabase.from("team_members").update({ status }).eq("user_id", id.data).select("user_id");
  if (error || !data?.length) return { ok: false, error: "Couldn’t save that change. Please try again." };
  revalidatePath("/team");
  return { ok: true };
}

export async function approveMember(userId: string): Promise<ActionResult> {
  return decide(userId, "approved");
}

export async function rejectMember(userId: string): Promise<ActionResult> {
  return decide(userId, "rejected");
}

export async function removeMember(userId: string): Promise<ActionResult> {
  return decide(userId, "removed");
}

/** Bring back someone who was rejected or removed. */
export async function reapproveMember(userId: string): Promise<ActionResult> {
  return decide(userId, "approved");
}
