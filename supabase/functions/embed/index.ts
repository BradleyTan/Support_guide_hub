// Turns text into 384-number vectors with Supabase's built-in gte-small model (runs inside Supabase; no third party).
// Only signed-in users may call it. Body: { "texts": string[] } → { "embeddings": number[][] }.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const model = new Supabase.ai.Session("gte-small");
const MAX_TEXTS = 64;
const MAX_CHARS = 4000; // gte-small reads ~512 tokens; longer input is truncated anyway

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * The gateway also accepts the public (publishable) key, so confirm there is a real signed-in user,
 * and that they are an approved team member.
 */
async function caller(req: Request): Promise<"none" | "pending" | "member"> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return "none";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return "none";
  const { data: member, error: memberError } = await supabase.rpc("is_member");
  if (memberError) console.error("[embed] membership check failed", memberError.message);
  return member === true ? "member" : "pending";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const who = await caller(req);
  if (who === "none") return json({ error: "Sign in required" }, 401);
  if (who === "pending") return json({ error: "not_approved" }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const texts = (body as { texts?: unknown })?.texts;
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS || !texts.every((t) => typeof t === "string" && t.trim())) {
    return json({ error: `texts must be 1–${MAX_TEXTS} non-empty strings` }, 400);
  }

  const embeddings: number[][] = [];
  for (const text of texts as string[]) {
    const output = await model.run(text.slice(0, MAX_CHARS), { mean_pool: true, normalize: true });
    embeddings.push(Array.from(output as ArrayLike<number>));
  }
  return json({ embeddings });
});
