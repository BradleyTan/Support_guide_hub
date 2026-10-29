import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/supabase/server";
import { canUseApp } from "@/lib/team-rules";
import { getMembership } from "@/lib/team";
import { getGuides, getPaletteArticles } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects signed-out visitors; this is the authoritative check.
  const user = await getUser();
  if (!user) redirect("/login");
  if (!canUseApp(await getMembership())) redirect("/waiting");
  const [guides, articles] = await Promise.all([getGuides(), getPaletteArticles()]);
  return (
    <AppShell email={user.email} guides={guides.map(({ id, title, errorMessage }) => ({ id, title, errorMessage }))} articles={articles}>
      {children}
    </AppShell>
  );
}
