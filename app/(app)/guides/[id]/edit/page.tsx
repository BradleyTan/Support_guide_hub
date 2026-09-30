import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuideForm } from "@/components/guides/guide-form";
import { getGuide } from "@/lib/data";
import { guideToInput } from "@/lib/guide-schema";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/guides/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit ${id}` };
}

export default async function EditGuidePage({ params }: PageProps<"/guides/[id]/edit">) {
  const { id } = await params;
  const [user, guide] = await Promise.all([getUser(), getGuide(id)]);
  if (!user) redirect("/login");
  if (!guide) notFound();
  return <GuideForm mode="edit" userId={user.id} code={guide.id} guideDbId={guide.dbId} initial={guideToInput(guide)} attachments={guide.attachments} />;
}
