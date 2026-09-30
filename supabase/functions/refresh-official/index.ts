// Keeps public.official_pages in step with the AutoCount help centres.
//   mode "sync"    (daily): read each help centre's sitemap.xml, add new articles, flag changed ones, drop removed ones.
//   mode "details" (every 10 min): read a small batch of new/changed article pages for title + summary, then embed them.
// Respects robots.txt: only /support/sitemap.xml and /support/solutions/articles/* are read; /support/search is never used.
// Called by pg_cron. Work per call is small and bounded, and it only handles public information.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITES = [
  { domain: "help.accounting.autocountcloud.com", label: "AutoCount Cloud Accounting help centre" },
  { domain: "help.hrms.autocountcloud.com", label: "AutoCount HRMS / Payroll help centre" },
];
const USER_AGENT = "SupportDeskIndexer/1.0 (personal support-notes tool; reads sitemap and articles only)";
const DETAILS_BATCH = 5; // keeps each run well inside the Edge Function CPU limit
const SYNC_MIN_HOURS = 20;
const REMOVE_AFTER_DAYS = 3;
const ARTICLE = /^https:\/\/[^/]+\/support\/solutions\/articles\/\d+-[\w-]+\/?$/;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const model = new Supabase.ai.Session("gte-small");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function get(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Fallback title from the article address, e.g. ".../69000874912-lhdn-calculator" → "LHDN calculator". */
const ACRONYMS: Record<string, string> = { pcb: "PCB", epf: "EPF", socso: "SOCSO", eis: "EIS", sst: "SST", lhdn: "LHDN", hrms: "HRMS", qr: "QR", api: "API", ea: "EA", cp38: "CP38", faq: "FAQ", gl: "GL", pdf: "PDF", csv: "CSV" };
function slugTitle(url: string) {
  const slug = url.replace(/\/$/, "").split("/").pop()!.replace(/^\d+-/, "");
  const words = slug.split("-").filter(Boolean).map((w) => ACRONYMS[w] ?? w);
  const text = words.join(" ").replace(/\be invoice\b/gi, "e-Invoice");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function sync() {
  const { data: last } = await db.from("official_pages").select("seen_at").order("seen_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - Date.parse(last.seen_at) < SYNC_MIN_HOURS * 3_600_000) return { skipped: "synced recently" };

  const now = new Date().toISOString();
  const report: Record<string, unknown> = {};
  for (const site of SITES) {
    try {
      const xml = await get(`https://${site.domain}/support/sitemap.xml`);
      const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap((m) => {
        const loc = decode(m[1].match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? "");
        const lastmod = m[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim() ?? null;
        return ARTICLE.test(loc) && new URL(loc).hostname === site.domain ? [{ url: loc, lastmod }] : [];
      });

      const { data: existing } = await db.from("official_pages").select("url, lastmod").eq("site", site.label);
      const known = new Map((existing ?? []).map((r) => [r.url, r.lastmod]));
      const fresh = entries.filter((e) => !known.has(e.url));
      const changed = entries.filter((e) => known.has(e.url) && e.lastmod && Date.parse(e.lastmod) !== Date.parse(known.get(e.url) ?? ""));

      if (fresh.length) await db.from("official_pages").insert(fresh.map((e) => ({ url: e.url, site: site.label, title: slugTitle(e.url), lastmod: e.lastmod, seen_at: now })));
      for (const e of changed) await db.from("official_pages").update({ lastmod: e.lastmod, details_fetched_at: null, embedding: null }).eq("url", e.url);
      if (entries.length) await db.from("official_pages").update({ seen_at: now }).in("url", entries.map((e) => e.url).filter((u) => known.has(u)));

      // Only prune when the sitemap looked healthy, so a bad fetch never wipes the index.
      if (entries.length > 20) {
        const cutoff = new Date(Date.now() - REMOVE_AFTER_DAYS * 86_400_000).toISOString();
        await db.from("official_pages").delete().eq("site", site.label).lt("seen_at", cutoff);
      }
      report[site.domain] = { articles: entries.length, added: fresh.length, changed: changed.length };
    } catch (e) {
      report[site.domain] = { error: String(e) };
    }
  }
  return report;
}

async function details() {
  const { data: pending } = await db
    .from("official_pages")
    .select("url, title, snippet, details_fetched_at")
    .or("details_fetched_at.is.null,embedding.is.null")
    .order("lastmod", { ascending: false, nullsFirst: false })
    .limit(DETAILS_BATCH);

  let done = 0;
  for (const p of pending ?? []) {
    let title = p.title;
    let snippet = p.snippet;
    if (!p.details_fetched_at) {
      try {
        const html = await get(p.url);
        // The help centres put the clean article title/summary in Open Graph tags; <title> is "Site : Article".
        const og = (name: string) => decode(html.match(new RegExp(`<meta\\s+property=(["'])og:${name}\\1\\s+content=(["'])([\\s\\S]*?)\\2`, "i"))?.[3] ?? "");
        const t = og("title") || decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").split(" : ").pop()!;
        const d = og("description");
        if (t) title = t.slice(0, 300);
        if (d) snippet = d.slice(0, 500);
      } catch {
        // Keep the title from the address; try the page again next day via the lastmod check.
      }
    }
    const vector = await model.run(`${title}\n${snippet}`.slice(0, 2000), { mean_pool: true, normalize: true });
    await db
      .from("official_pages")
      .update({ title, snippet, details_fetched_at: new Date().toISOString(), embedding: `[${Array.from(vector as ArrayLike<number>).join(",")}]` })
      .eq("url", p.url);
    done++;
  }
  return { processed: done };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const mode = ((await req.json().catch(() => ({}))) as { mode?: string }).mode;
  if (mode === "sync") return json(await sync());
  if (mode === "details") return json(await details());
  return json({ error: 'mode must be "sync" or "details"' }, 400);
});
