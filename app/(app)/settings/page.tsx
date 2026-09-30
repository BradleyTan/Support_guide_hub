import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getDeletedGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  return <SettingsView deleted={await getDeletedGuides()} />;
}
