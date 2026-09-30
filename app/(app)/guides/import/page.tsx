import type { Metadata } from "next";
import { ImportWizard } from "@/components/guides/import-wizard";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Import guides" };

export default async function ImportPage() {
  const guides = await getGuides();
  return <ImportWizard existing={guides.map(({ id, title }) => ({ code: id, title }))} />;
}
