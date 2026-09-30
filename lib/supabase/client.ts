"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client (signed-in user's session from cookies). Used only for direct file uploads. */
export function supabaseBrowser() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
