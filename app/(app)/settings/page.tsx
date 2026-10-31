import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getDeletedArticles, getDeletedChats, getDeletedGuides } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/team";
import { isOwner } from "@/lib/team-rules";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const membership = await getMembership();
  const displayName = membership?.displayName ?? "";
  if (!isOwner(membership)) {
    // Members only see their own deleted chats and the account card; the owner-only data is never fetched.
    return (
      <SettingsView
        deleted={[]}
        deletedArticles={[]}
        deletedChats={await getDeletedChats()}
        chat={{ model: "", webSearch: false }}
        indexed={{ count: 0, lastRefreshed: null }}
        searchesLogged={0}
        displayName={displayName}
      />
    );
  }
  const supabase = await createClient();
  const [deleted, deletedArticles, deletedChats, { data: chatSettings }, { count }, { data: latest }, { count: searches }] = await Promise.all([
    getDeletedGuides(),
    getDeletedArticles(),
    getDeletedChats(),
    // The team row (the owner's), not every settings row the owner can read.
    supabase.rpc("team_settings").maybeSingle(),
    supabase.from("official_pages").select("url", { count: "exact", head: true }),
    supabase.from("official_pages").select("seen_at").order("seen_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("search_log").select("id", { count: "exact", head: true }),
  ]);
  return (
    <SettingsView
      deleted={deleted}
      deletedArticles={deletedArticles}
      deletedChats={deletedChats}
      chat={{ model: chatSettings?.chat_model ?? "openai/gpt-oss-120b", webSearch: chatSettings?.chat_web_search ?? false }}
      indexed={{ count: count ?? 0, lastRefreshed: latest?.seen_at ?? null }}
      searchesLogged={searches ?? 0}
      displayName={displayName}
    />
  );
}
