// Copies lib/accountant/core/*.ts into the Edge Functions' shared folder, so the app and ask-accountant run the
// same checks. tests/accountant-core-sync.test.ts fails if the copies drift.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";

const from = "lib/accountant/core";
const to = "supabase/functions/_shared/accountant-core";

mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((f) => f.endsWith(".ts"));
for (const f of readdirSync(to)) if (f.endsWith(".ts") && !files.includes(f)) rmSync(`${to}/${f}`);
for (const f of files) copyFileSync(`${from}/${f}`, `${to}/${f}`);
console.log(`Copied ${files.length} files to ${to}`);
