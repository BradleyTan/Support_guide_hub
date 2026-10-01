import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load local settings (E2E_EMAIL / E2E_PASSWORD, Supabase URL and key) for the test run.
// Variables already set in the environment (e.g. CI) take precedence; CI has no .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Tests run against a production build on its own port, so they never race the dev server's on-demand compiler.
const PORT = 3100;
const AUTH_FILE = "e2e/.auth/user.json";
const signedIn = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD && process.env.E2E_SIGNED_IN !== "0";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  // No traces: they record typed text, which would include the test account password.
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "off" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: signedIn ? AUTH_FILE : undefined },
    },
    {
      name: "phone",
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: signedIn ? AUTH_FILE : undefined },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
