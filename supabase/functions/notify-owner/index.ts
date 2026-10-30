// Emails the owner when someone signs up and is waiting for approval.
//   POST { user_id } with the x-notify-secret header → { ok: true }
// Called only by the team_members trigger (migration 0015), which sends a secret kept in the database Vault;
// other callers get 401. Names and emails are read here with the service role and never returned.
// The email goes out through Gmail SMTP (port 465, TLS) with the SMTP_USER / SMTP_PASS secrets. A failed or
// skipped send is logged and still answered with 200, so sign-up is never blocked or retried in a loop.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const TEAM_PAGE = "https://atc-supportguide.netlify.app/team";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** One line of plain text: no line breaks (they would break the subject header) and a sane length. */
function oneLine(text: string, max = 120): string {
  return text.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type Signup = { name: string; email: string };

/** The waiting person and the owner's address, or null when there is nothing to send. */
async function lookUp(userId: string): Promise<{ signup: Signup; ownerEmail: string } | null> {
  const [person, owner] = await Promise.all([
    db.from("team_members").select("email, display_name, status").eq("user_id", userId).maybeSingle(),
    db.from("team_members").select("email").eq("role", "owner").maybeSingle(),
  ]);
  if (person.error || owner.error) {
    console.error("[notify-owner] lookup failed", person.error?.message ?? owner.error?.message);
    return null;
  }
  if (!person.data || person.data.status !== "pending" || !owner.data?.email) return null;
  const email = oneLine(person.data.email ?? "", 254);
  const name = oneLine(person.data.display_name ?? "") || email || "Someone";
  return { signup: { name, email }, ownerEmail: owner.data.email };
}

async function send(to: string, { name, email }: Signup): Promise<void> {
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) {
    console.error("[notify-owner] SMTP_USER / SMTP_PASS are not set; email skipped");
    return;
  }
  const client = new SMTPClient({ connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } } });
  const who = email && email !== name ? `${name} (${email})` : name;
  try {
    await client.send({
      from: user,
      to,
      subject: `New sign-up waiting: ${name}`,
      content: `${who} has signed up for the Support Desk and is waiting for approval.\n\nApprove or reject them on the Team page: ${TEAM_PAGE}\n`,
      html:
        `<p>${escapeHtml(who)} has signed up for the Support Desk and is waiting for approval.</p>` +
        `<p><a href="${TEAM_PAGE}">Open the Team page</a> to approve or reject them.</p>`,
    });
  } finally {
    try {
      await client.close();
    } catch {
      // The email has already been handed over (or failed above); a failed close changes nothing.
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = req.headers.get("x-notify-secret") ?? "";
  const { data: allowed, error: authErr } = secret ? await db.rpc("notify_owner_secret_ok", { p_secret: secret }) : { data: false, error: null };
  if (authErr) console.error("[notify-owner] secret check failed", authErr.message);
  if (allowed !== true) return json({ error: "Not allowed" }, 401);

  let userId = "";
  try {
    const body = await req.json();
    userId = typeof body?.user_id === "string" ? body.user_id : "";
  } catch {
    userId = "";
  }
  if (!UUID.test(userId)) return json({ error: "Bad request" }, 400);

  try {
    const found = await lookUp(userId);
    if (found) await send(found.ownerEmail, found.signup);
  } catch (e) {
    // Only the error message is logged, never the SMTP settings or the addresses.
    console.error("[notify-owner] email not sent:", e instanceof Error ? e.message : "unknown error");
  }
  return json({ ok: true });
});
