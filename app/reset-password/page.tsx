import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/app/reset-password/reset-form";

export const metadata: Metadata = { title: "Set a new password" };

/** Reached from the reset email link (signed in by /auth/confirm) or from Settings. */
export default async function ResetPasswordPage() {
  const user = await getUser();
  if (!user) redirect("/login?error=reset");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <ResetPasswordForm email={user.email} />
    </main>
  );
}
