import type { Metadata } from "next";
import { GuideForm } from "@/components/guides/guide-form";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "New guide" };

export default async function NewGuidePage() {
  return <GuideForm guides={await getGuides()} />;
}
