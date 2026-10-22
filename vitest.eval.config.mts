import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** The live Accountant chat quality check (npm run eval:accountant). Kept out of npm test: it uses the free Groq quota. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
