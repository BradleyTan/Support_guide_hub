// Accountant chat: answers a (masked) customer scenario with Groq, grounded in the signed-in user's guides,
// Knowledge hub articles and the AutoCount help centres, then runs the plain-code checks before replying.
//   POST { message, history, mask } with the user's access token → { checked, mask }
// Called from the browser (Netlify's free functions time out too soon). Reads run as the user, so RLS applies.
// The Groq key is the GROQ_API_KEY secret and never leaves this function. Help-centre pages: article URLs only
// (robots.txt), never /support/search.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { modelAnswerJsonSchema, parseAnswer, type Source } from "../_shared/accountant-core/answer.ts";
import { checkAnswer } from "../_shared/accountant-core/checks.ts";
import { autoMask, type MaskMap } from "../_shared/accountant-core/mask.ts";
import { buildMessages } from "../_shared/accountant-core/prompt.ts";
import { articleBody, htmlToText, isFetchableArticle, searchQuery, toGuideSource, toKnowledgeSources, toOfficialSource } from "../_shared/accountant-core/sources.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const USER_AGENT = "SupportDeskIndexer/1.0 (personal support-notes tool; reads sitemap and articles only)";
const PLACEHOLDER_KEY = /^\[(COMPANY|IC|BANK|PHONE|EMAIL|HIDDEN) \d+\]$/;
// The chat's placeholder map grows with every name and number in the scenario and its sources.
const MAX_MASK_ENTRIES = 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });
}

type Turn = { role: "user" | "assistant"; content: string };

/** The request body, checked by hand (no zod needed for this small shape). */
function readBody(body: unknown): { message: string; history: Turn[]; mask: MaskMap; forceWeb: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 4000) return null;
  const history = Array.isArray(b.history) ? b.history : [];
  if (history.length > 12) return null;
  for (const h of history) {
    if (!h || (h.role !== "user" && h.role !== "assistant") || typeof h.content !== "string" || h.content.length > 8000) return null;
  }
  const mask = b.mask && typeof b.mask === "object" && !Array.isArray(b.mask) ? (b.mask as Record<string, unknown>) : {};
  const entries = Object.entries(mask);
  if (entries.length > MAX_MASK_ENTRIES || entries.some(([k, v]) => !PLACEHOLDER_KEY.test(k) || typeof v !== "string" || v.length > 300)) return null;
  return { message: b.message, history: (history as Turn[]).slice(-6), mask: mask as MaskMap, forceWeb: b.forceWeb === true };
}

const embedder = new Supabase.ai.Session("gte-small");
async function embed(text: string): Promise<string | null> {
  try {
    const v = await embedder.run(text.slice(0, 2000), { mean_pool: true, normalize: true });
    return `[${Array.from(v as ArrayLike<number>).join(",")}]`;
  } catch {
    return null;
  }
}

async function fetchArticleText(url: string): Promise<string> {
  if (!isFetchableArticle(url)) return "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(8_000) });
    return res.ok ? htmlToText(articleBody(await res.text())) : "";
  } catch {
    return "";
  }
}

type Db = ReturnType<typeof createClient>;

/** Guides first, then Knowledge hub, then help-centre pages — the order the prompt asks the model to prefer. */
async function gatherSources(db: Db, message: string): Promise<Source[]> {
  const q = searchQuery(message);
  const vector = await embed(message);
  const [guideHits, articleHits, officialHits] = await Promise.all([
    q || vector ? db.rpc("search_guides", { p_query: q, p_embedding: vector, p_limit: 4 }) : { data: [] },
    q ? db.rpc("search_knowledge", { p_query: q, p_limit: 3 }) : { data: [] },
    q || vector ? db.rpc("search_official_pages", { p_query: q, p_embedding: vector, p_limit: 3 }) : { data: [] },
  ]);

  const guideIds: string[] = (guideHits.data ?? []).map((h: { id: string }) => h.id);
  const articleIds: string[] = (articleHits.data ?? []).map((h: { id: string }) => h.id);
  const [guides, articles, pageTexts] = await Promise.all([
    guideIds.length ? db.from("guides").select("id, code, title, symptom, cause, steps, verified, platform").in("id", guideIds).is("deleted_at", null) : { data: [] },
    articleIds.length
      ? db.from("knowledge_articles").select("id, title, tell_customer, what_it_is, desktop_steps, cloud_steps, steps_verified, reviewed").in("id", articleIds).is("deleted_at", null)
      : { data: [] },
    Promise.all((officialHits.data ?? []).map((p: { url: string }) => fetchArticleText(p.url))),
  ]);

  const byOrder = <T extends { id: string }>(rows: T[], ids: string[]) => ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is T => !!r);
  return [
    ...byOrder(guides.data ?? [], guideIds).map(toGuideSource),
    ...byOrder(articles.data ?? [], articleIds).flatMap(toKnowledgeSources),
    ...(officialHits.data ?? []).map((p: { url: string; title: string; snippet: string }, i: number) => toOfficialSource(p, pageTexts[i] ?? "")),
  ];
}

class GroqError extends Error {
  constructor(
    public status: number,
    public retryAfter: number,
    message: string,
  ) {
    super(message);
  }
}

async function groq(key: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new GroqError(res.status, Number(res.headers.get("retry-after")) || 60, detail);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

/** Optional first step: Groq's browser search, as one Web source. It can inform the answer but never confirms a path. */
async function webSource(key: string, model: string, message: string): Promise<Source | null> {
  const text = await groq(key, {
    model,
    messages: [
      { role: "system", content: "Search the web for Malaysian accounting guidance on this scenario. Summarise the relevant facts in under 250 words and list the URLs you used." },
      { role: "user", content: message },
    ],
    tools: [{ type: "browser_search" }],
    tool_choice: "required",
    reasoning_effort: "low",
    max_completion_tokens: 900,
  });
  if (!text.trim()) return null;
  return { id: "web", kind: "web", title: "Web search", url: text.match(/https:\/\/[^\s)\]]+/)?.[0] ?? "", platform: null, checked: false, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in required" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: who, error: authError } = await db.auth.getUser(token);
  if (authError || !who.user || who.user.is_anonymous) return json({ error: "Sign in required" }, 401);

  let input: ReturnType<typeof readBody>;
  try {
    const body = await req.json();
    const mask = body?.mask;
    if (mask && typeof mask === "object" && Object.keys(mask).length > MAX_MASK_ENTRIES) return json({ error: "mask_too_large" }, 400);
    input = readBody(body);
  } catch {
    input = null;
  }
  if (!input) return json({ error: "Send a message (up to 4,000 characters)." }, 400);

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  const { data: settings } = await db.from("user_settings").select("chat_model, chat_web_search").maybeSingle();
  const model = settings?.chat_model || DEFAULT_MODEL;

  try {
    const sources = await gatherSources(db, input.message);
    // Web search runs when asked for ("Search the web too"), or automatically when the setting is on and the
    // checked sources are thin. It is optional: if Groq refuses it, the answer uses the user's own sources.
    let web: "used" | "failed" | "off" = "off";
    if (input.forceWeb || (settings?.chat_web_search && sources.filter((s) => s.checked).length < 2)) {
      // Masked again here too: the browser already hid names, but this call must never depend on that alone.
      // Any refusal here (including "too large" or "busy": page text from the web can exceed the free per-minute
      // limit on its own) only means no web source; the answer still comes from the user's own sources.
      const found = await webSource(key, model, autoMask(input.message, input.mask).text).catch((e) => {
        console.error("[ask-accountant] web search failed", e instanceof GroqError ? `${e.status} ${e.message}` : e);
        return null;
      });
      web = found ? "used" : "failed";
      if (found) sources.push(found);
    }

    const built = buildMessages({ history: input.history, message: input.message, sources, map: input.mask });
    const request = {
      model,
      messages: built.messages,
      response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: modelAnswerJsonSchema } },
      reasoning_effort: "medium",
      max_completion_tokens: 2000,
      temperature: 0.2,
    };
    // Groq checks the JSON against the schema itself and answers 400 when the model's output doesn't fit;
    // that, like output our own check rejects, is a bad answer worth one more try.
    const attempt = async () => {
      try {
        return parseAnswer(await groq(key, request));
      } catch (e) {
        if (e instanceof GroqError && e.status === 400 && /schema|failed_generation|json_validate/i.test(e.message)) return { ok: false as const, error: "Groq's output didn't match the schema." };
        throw e;
      }
    };
    let parsed = await attempt();
    if (!parsed.ok) parsed = await attempt(); // one retry
    if (!parsed.ok) return json({ error: "bad_answer", detail: parsed.error }, 502);

    return json({ checked: checkAnswer(parsed.answer, built.sources, built.map, built.replyPlaceholders), mask: built.map, web });
  } catch (e) {
    if (e instanceof GroqError) {
      if (e.status === 429) return json({ error: "rate_limited", retryAfter: e.retryAfter }, 429, { "Retry-After": String(e.retryAfter) });
      if (e.status === 401 || e.status === 403) return json({ error: "not_configured" }, 503);
      return json({ error: "groq_error", detail: e.message }, 502);
    }
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
