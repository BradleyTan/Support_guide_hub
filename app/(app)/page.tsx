import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  return <HomeView guides={await getGuides()} />;
}
