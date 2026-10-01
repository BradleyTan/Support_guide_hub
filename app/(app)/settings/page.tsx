import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getDeletedGuides } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [deleted, { count }, { data: latest }, { count: searches }] = await Promise.all([
    getDeletedGuides(),
    supabase.from("official_pages").select("url", { count: "exact", head: true }),
    supabase.from("official_pages").select("seen_at").order("seen_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("search_log").select("id", { count: "exact", head: true }),
  ]);
  return <SettingsView deleted={deleted} indexed={{ count: count ?? 0, lastRefreshed: latest?.seen_at ?? null }} searchesLogged={searches ?? 0} />;
}
