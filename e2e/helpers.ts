import { expect, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { waitForApp } from "./fixtures";

export const AUTH_FILE = "e2e/.auth/user.json";
/** E2E_BASE_URL runs the tests against another address (e.g. the live site) instead of a local build. */
export const remoteTarget = !!process.env.E2E_BASE_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.E2E_BASE_URL);
/**
 * Signed-in tests run only against this PC: the test account is never typed into a live site.
 * Set E2E_SIGNED_IN=0 to run only the signed-out tests locally too.
 */
export const hasTestAccount = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD && process.env.E2E_SIGNED_IN !== "0" && !remoteTarget;
export const allowWrites = hasTestAccount && process.env.E2E_ALLOW_WRITES === "1";

/**
 * Signs in on a fresh page. Only for tests that must end a session (sign-out tests), so they never
 * revoke the shared session the other tests reuse.
 */
export async function signInFresh(page: Page) {
  await page.goto("/login");
  await waitForApp(page);
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

/** A brand-new, signed-out browser context (e.g. a second device). */
export async function freshContext(browser: Browser) {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

/** Runs `work` signed in as the test member with a throwaway client, then signs that client out (local only). */
export async function withTestClient(work: (sb: SupabaseClient) => Promise<void>) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
  if (error) throw new Error("The test account couldn't sign in for cleanup.");
  try {
    await work(sb);
  } finally {
    await sb.auth.signOut({ scope: "local" });
  }
}

/**
 * Removes everything the test member created with an "[e2e]" title, plus its search log. Members can't DELETE shared rows
 * under RLS, so this goes through the e2e_cleanup() database function, which only the test account can call.
 */
export async function e2eCleanup(extra?: (sb: SupabaseClient) => Promise<void>) {
  await withTestClient(async (sb) => {
    const { error } = await sb.rpc("e2e_cleanup");
    if (error) throw new Error(`e2e_cleanup failed: ${error.message}`);
    await extra?.(sb);
  });
}

/**
 * Prefixes "[e2e] " to the title of rows this test account created, so e2e_cleanup() (which matches only "[e2e]" titles) removes
 * them. Members may UPDATE shared rows under RLS; the user_id filter keeps this to the test account's own rows.
 */
export async function markAsE2E(
  sb: SupabaseClient,
  table: "analyses" | "knowledge_articles",
  match: { column: "code" | "starter_slug" | "title"; values: string[]; createdSince?: string },
) {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user || !match.values.length) return;
  let query = sb.from(table).select("id, title").eq("user_id", auth.user.id).in(match.column, match.values);
  if (match.createdSince) query = query.gte("created_at", match.createdSince);
  const { data } = await query;
  for (const row of data ?? []) {
    if (row.title.startsWith("[e2e]")) continue;
    await sb.from(table).update({ title: `[e2e] ${row.title}` }).eq("id", row.id);
  }
}
