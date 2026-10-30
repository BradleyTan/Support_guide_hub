import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamView } from "@/components/team/team-view";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/team";
import { groupMembers, isOwner, type TeamMemberRow } from "@/lib/team-rules";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  if (!isOwner(await getMembership())) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("team_members").select("user_id, email, display_name, role, status, created_at");
  const rows: TeamMemberRow[] = (data ?? []).map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  }));
  return <TeamView groups={groupMembers(rows)} />;
}
