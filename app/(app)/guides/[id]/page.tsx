import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuideDetail } from "@/components/guides/guide-detail";
import { getGuide, getGuides } from "@/lib/data";
import { createClient, getUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/guides/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getGuide(id))?.title ?? "Guide not found" };
}

export default async function GuidePage({ params }: PageProps<"/guides/[id]">) {
  const { id } = await params;
  const [user, guide, all] = await Promise.all([getUser(), getGuide(id), getGuides()]);
  if (!user) redirect("/login");
  if (!guide) notFound();
  // Count the view. Done during render (not in after()), because after() can't read the session cookie in a page.
  await (await createClient()).rpc("increment_guide_uses", { p_guide_id: guide.dbId! });
  return <GuideDetail guide={guide} allGuides={all} userId={user.id} />;
}
