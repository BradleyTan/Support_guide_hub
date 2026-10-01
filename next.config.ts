import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests build into their own folder (see playwright.config.ts) so they never disturb the dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
