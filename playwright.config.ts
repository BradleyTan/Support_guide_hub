import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load local settings (E2E_EMAIL / E2E_PASSWORD, Supabase URL and key) for the test run.
// Variables already set in the environment (e.g. CI) take precedence; CI has no .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Tests run against a production build on its own port, so they never race the dev server's on-demand compiler.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
