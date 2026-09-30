import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getUser } from "@/lib/supabase/server";
import { getGuides } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects signed-out visitors; this is the authoritative check.
  const user = await getUser();
  if (!user) redirect("/login");
  const guides = await getGuides();
  return (
    <AppShell email={user.email} guides={guides.map(({ id, title, errorMessage }) => ({ id, title, errorMessage }))}>
      {children}
    </AppShell>
  );
}
