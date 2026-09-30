"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type AuthState } from "@/app/login/actions";
import { FormMessages, Mark } from "@/app/login/login-form";

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Mark />
        <h1 className="mt-3 text-xl font-semibold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">For {email}</p>
      </div>
      <form action={action} className="flex flex-col gap-4 rounded-lg border bg-card p-5" noValidate>
        {/* Helps password managers save the new password against the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-invalid={!!state.error} />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} aria-invalid={!!state.error} />
        </div>
        <FormMessages error={state.error} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save new password
        </Button>
      </form>
    </div>
  );
}
