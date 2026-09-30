import type { Metadata } from "next";
import { ReleasesView } from "@/components/library/releases-view";
import { getReleaseNotes } from "@/lib/data";

export const metadata: Metadata = { title: "Versions & releases" };

export default async function ReleasesPage() {
  return <ReleasesView releaseNotes={await getReleaseNotes()} />;
}
