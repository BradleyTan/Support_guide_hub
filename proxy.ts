import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, images and the screenshot-reading engine (open-source files, nothing private).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ocr/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
