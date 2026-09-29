import type { Metadata } from "next";
import { ImportWizard } from "@/components/guides/import-wizard";

export const metadata: Metadata = { title: "Import guides" };

export default function ImportPage() {
  return <ImportWizard />;
}
