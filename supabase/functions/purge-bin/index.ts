// Nightly bin clean-up: permanently removes items that were deleted (moved to the bin) more than 30 days ago.
//   guides  → their files in the private "attachments" bucket first, then the rows (attachments, revisions,
//             pins, open events and version-note links go with them; SOPs built from them are kept, unlinked)
//   sops, analyses (with their messages), templates, release_notes → the rows
// Called only by pg_cron, which sends a secret kept in the database Vault (x-purge-secret); other callers get 401.
// It takes no other input and only ever removes what has been in the bin for 30+ days. Storage files can't be
// deleted from SQL, which is why this runs as a function with the service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const KEEP_DAYS = 30;
const BATCH = 200; // guides per run; anything left over is picked up the next night

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = req.headers.get("x-purge-secret") ?? "";
  const { data: allowed, error: authErr } = secret ? await db.rpc("purge_bin_secret_ok", { p_secret: secret }) : { data: false, error: null };
  if (authErr) console.error("[purge-bin] secret check failed", authErr);
  if (allowed !== true) return json({ error: "Not allowed" }, 401);

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const removed: Record<string, number> = {};

  try {
    // Guides: files first, so a failure never leaves files without a guide that points to them.
    const { data: guides, error: gErr } = await db.from("guides").select("id").lt("deleted_at", cutoff).limit(BATCH);
    if (gErr) throw gErr;
    const ids = (guides ?? []).map((g) => g.id);
    if (ids.length) {
      const { data: files, error: fErr } = await db.from("guide_attachments").select("storage_path").in("guide_id", ids);
      if (fErr) throw fErr;
      const paths = (files ?? []).map((f) => f.storage_path);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db.storage.from("attachments").remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      removed.files = paths.length;
      const { error, count } = await db.from("guides").delete({ count: "exact" }).in("id", ids);
      if (error) throw error;
      removed.guides = count ?? 0;
    }

    for (const table of ["sops", "analyses", "templates", "release_notes"] as const) {
      const { error, count } = await db.from(table).delete({ count: "exact" }).lt("deleted_at", cutoff);
      if (error) throw error;
      removed[table] = count ?? 0;
    }
    return json({ ok: true, cutoff, removed });
  } catch (e) {
    console.error("[purge-bin]", e);
    return json({ ok: false, removed, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
