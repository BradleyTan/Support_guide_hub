import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

/** Landing point for email links: sign-up confirmation and password reset (next=/reset-password). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/"));

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing token") };

  if (error) {
    const reason = next === "/reset-password" ? "reset" : "confirm";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
