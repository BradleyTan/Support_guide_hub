import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuideForm } from "@/components/guides/guide-form";
import { answerToGuideInput } from "@/lib/accountant/to-guide";
import { getChatAnswer } from "@/lib/data";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New guide" };

export default async function NewGuidePage({ searchParams }: PageProps<"/guides/new">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { title, fromChat } = await searchParams;
  // "Save as guide" from the Accountant chat: prefilled from that answer; the user picks the product and saves.
  const fromAnswer = typeof fromChat === "string" ? await getChatAnswer(fromChat) : null;
  const prefill = fromAnswer ? answerToGuideInput(fromAnswer.answer, fromAnswer.scenario) : typeof title === "string" ? { title: title.slice(0, 300) } : undefined;
  return <GuideForm mode="create" userId={user.id} prefill={prefill} />;
}
