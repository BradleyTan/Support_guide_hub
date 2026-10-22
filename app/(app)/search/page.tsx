import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";
import { searchChats, searchKnowledge, searchMyGuides, searchOfficialSources } from "@/app/(app)/search/actions";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  // Opened with ?q= (e.g. from Home): run the first search here so results arrive with the page.
  const [guides, initialMine, initialOfficial, initialKnowledge, initialChats] = await Promise.all([
    getGuides(),
    query ? searchMyGuides(query, {}, false) : null,
    query ? searchOfficialSources(query) : null,
    query ? searchKnowledge(query) : null,
    query ? searchChats(query) : null,
  ]);
  return <SearchView initialQuery={query} initialMine={initialMine} initialOfficial={initialOfficial} initialKnowledge={initialKnowledge?.ok ? initialKnowledge.hits : []} initialChats={initialChats?.ok ? initialChats.hits : []} guides={guides.map(({ id, title }) => ({ id, title }))} />;
}
