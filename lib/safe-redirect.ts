/** Returns `next` only if it is a path inside this app; otherwise "/". Blocks open redirects like "//evil.com". */
export function safeNext(next: unknown, fallback = "/") {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}
