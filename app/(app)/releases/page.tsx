import type { Metadata } from "next";
import { ReleasesView } from "@/components/library/releases-view";
import { getGuides, getReleaseNotes } from "@/lib/data";

export const metadata: Metadata = { title: "Versions & releases" };

export default async function ReleasesPage() {
  const [releaseNotes, guides] = await Promise.all([getReleaseNotes(), getGuides()]);
  return <ReleasesView releaseNotes={releaseNotes} guides={guides.map((g) => ({ id: g.id, title: g.title }))} />;
}
