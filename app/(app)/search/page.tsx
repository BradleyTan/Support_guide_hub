import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  return <SearchView guides={await getGuides()} initialQuery={typeof q === "string" ? q : ""} />;
}
