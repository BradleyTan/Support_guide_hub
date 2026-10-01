import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuideForm } from "@/components/guides/guide-form";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New guide" };

export default async function NewGuidePage({ searchParams }: PageProps<"/guides/new">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { title } = await searchParams;
  return <GuideForm mode="create" userId={user.id} prefillTitle={typeof title === "string" ? title.slice(0, 300) : undefined} />;
}
