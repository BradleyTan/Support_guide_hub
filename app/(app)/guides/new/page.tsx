import type { Metadata } from "next";
import { GuideForm } from "@/components/guides/guide-form";

export const metadata: Metadata = { title: "New guide" };

export default function NewGuidePage() {
  return <GuideForm />;
}
