import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { FlashToast } from "@/components/shared/flash-toast";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { password } = await searchParams;
  return (
    <>
      {password === "updated" && <FlashToast message="Password updated. Use it next time you sign in." />}
      <HomeView guides={await getGuides()} />
    </>
  );
}
