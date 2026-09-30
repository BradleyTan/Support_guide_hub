"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

export type AuthState = { error?: string; message?: string; email?: string };

const emailField = z.email("Enter a valid email address.");
const passwordField = z.string().min(8, "Use at least 8 characters for the password.");
const credentials = z.object({ email: emailField, password: passwordField });

async function origin() {
  return (await headers()).get("origin") ?? "";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { email, error: "Please confirm your email first. Check your inbox for the link." };
    if (error.status === 429 || error.code === "over_request_rate_limit") return { email, error: "Too many sign-in attempts. Please wait a few minutes and try again." };
    if (error.code === "invalid_credentials") return { email, error: "Email or password is incorrect." };
    return { email, error: "Couldn’t sign in right now. Please try again in a moment." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: `${await origin()}/auth/confirm` } });
  if (error) {
    if (error.code === "over_email_send_rate_limit") return { email, error: "Too many emails sent in the last hour. Please try again later." };
    if (error.code === "weak_password") return { email, error: "That password is too easy to guess. Try a longer one." };
    return { email, error: "Couldn’t create the account. Please try again." };
  }
  // With email confirmation on, there is no session until the link is clicked.
  if (data.session) redirect("/");
  return { email, message: "Check your email and select the confirmation link. Then sign in here." };
}

/** Emails a password-reset link. The reply never reveals whether an account exists for the email. */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const parsed = emailField.safeParse(email);
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/confirm?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return { email, error: "Too many emails sent in the last hour. Please wait a while and try again." };
  }
  return {
    email,
    message: "If an account exists for this email, a reset link is on its way. Open it in this browser within 1 hour. Check your spam folder too.",
  };
}

/** Sets a new password for the signed-in user (after following the reset link). */
export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = form.get("password");
  const confirm = form.get("confirm");
  const parsed = passwordField.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "The two passwords don’t match." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Your reset link has expired. Request a new one from the sign-in page." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password different from your current one." };
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Try a longer one." };
    return { error: "Couldn’t update the password. Please try again." };
  }
  redirect("/?password=updated");
}

/** Signs out this device only; other devices (e.g. your phone) stay signed in. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
