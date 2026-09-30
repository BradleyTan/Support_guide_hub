"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, signIn, signUp, type AuthState } from "@/app/login/actions";

type Mode = "in" | "up" | "forgot";

export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="2" y="3" width="20" height="18" rx="3" className="fill-primary" />
      <path d="M12 6v12M5 9h4M5 12h4M5 15h3M15 9h4M15 12h3M15 15h4" className="stroke-primary-foreground" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FormMessages({ error, message }: { error?: string; message?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-start gap-2 text-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" /> {message}
        </p>
      )}
    </>
  );
}

const linkErrors: Record<string, string> = {
  confirm: "That confirmation link has expired or was already used. Sign in, or create the account again.",
  reset: "That reset link has expired or was already used. Request a new one below.",
};

const titles: Record<Mode, string> = {
  in: "Sign in to Support Desk",
  up: "Create your account",
  forgot: "Reset your password",
};

export function LoginForm({ next, linkError }: { next: string; linkError?: string }) {
  const [mode, setMode] = useState<Mode>(linkError === "reset" ? "forgot" : "in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const [fgState, fgAction, fgPending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  const state = mode === "in" ? inState : mode === "up" ? upState : fgState;
  const pending = mode === "in" ? inPending : mode === "up" ? upPending : fgPending;
  const action = mode === "in" ? inAction : mode === "up" ? upAction : fgAction;
  const untouched = !inState.email && !fgState.email;
  const error = state.error ?? (linkError && untouched ? linkErrors[linkError] : undefined);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <Mark />
        <h1 className="mt-3 text-xl font-semibold">{titles[mode]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot" ? "Enter your account email and we’ll send you a link to set a new password." : "Your AutoCount guides, private to you."}
        </p>
      </div>

      {mode !== "forgot" && (
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
      )}

      <form action={action} className="flex flex-col gap-4 rounded-lg border bg-card p-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email ?? inState.email}
            key={`e-${mode}`}
            aria-invalid={!!error}
          />
        </div>

        {mode !== "forgot" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              {mode === "in" && (
                <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={8}
              aria-invalid={!!error}
            />
            {mode === "up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
          </div>
        )}

        <FormMessages error={error} message={state.message} />

        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </Button>

        {mode === "forgot" && (
          <button type="button" onClick={() => setMode("in")} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
