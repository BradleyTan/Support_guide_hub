"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "@/app/login/actions";

function Mark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-9">
      <rect x="2" y="3" width="20" height="18" rx="3" className="fill-primary" />
      <path d="M12 6v12M5 9h4M5 12h4M5 15h3M15 9h4M15 12h3M15 15h4" className="stroke-primary-foreground" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LoginForm({ next, confirmFailed }: { next: string; confirmFailed: boolean }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;
  const error = state.error ?? (confirmFailed && mode === "in" && !inState.email ? "That confirmation link has expired or was already used. Sign in, or create the account again." : undefined);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Mark />
        <h1 className="mt-3 text-xl font-semibold">{mode === "in" ? "Sign in to Support Desk" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your AutoCount guides, private to you.</p>
      </div>

      <div role="tablist" aria-label="Sign in or create account" className="mb-4 grid grid-cols-2 rounded-lg border bg-card p-0.5 text-sm">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("h-8 rounded-md transition-colors", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={mode === "in" ? inAction : upAction} className="flex flex-col gap-4 rounded-lg border bg-card p-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} key={`e-${mode}`} aria-invalid={!!error} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} aria-invalid={!!error} />
          {mode === "up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
        {state.message && (
          <p role="status" className="flex items-start gap-2 text-sm text-success">
            <CircleCheck className="mt-0.5 size-4 shrink-0" /> {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
