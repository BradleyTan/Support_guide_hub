import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { style } = await searchParams;
  return <HomeView layout={style === "b" ? "b" : "a"} />;
}
