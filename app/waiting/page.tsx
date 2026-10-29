import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mark } from "@/app/login/login-form";
import { signOut } from "@/app/login/actions";
import { createClient, getUser } from "@/lib/supabase/server";
import { canUseApp, getMembershipStatusCopy } from "@/lib/team-rules";
import { getMembership } from "@/lib/team";

export default async function WaitingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const membership = await getMembership();
  if (canUseApp(membership)) redirect("/");

  const supabase = await createClient();
  const { data: ownerName } = await supabase.rpc("owner_name");
  const copy = getMembershipStatusCopy(membership, ownerName ?? "The owner");

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Mark />
        <h1 className="mt-3 text-xl font-semibold">{copy.heading}</h1>
        {copy.body && <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>}
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
    </main>
  );
}
