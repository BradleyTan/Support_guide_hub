import { expect, test } from "./fixtures";
import { allowWrites, e2eCleanup, hasTestAccount, withTestClient } from "./helpers";

/**
 * What an approved team MEMBER (the e2e test account) must not see. Read-only: nothing is saved.
 * The owner's side is covered by team-owner.spec.ts.
 */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");
test.skip(({ isMobile }) => isMobile, "member controls checked once, on desktop");

// With E2E_ALLOW_WRITES=1 the spec seeds its own "[e2e]" guide and chat, so the core checks always run.
// Without writes it uses whatever the account can already see, and skips when there is nothing.
let seededGuide: string | null = null;
let seededChat: string | null = null;

test.beforeAll(async () => {
  if (!allowWrites) return;
  await withTestClient(async (sb) => {
    const guide = await sb.from("guides").insert({ title: `[e2e] ${Date.now()} member view`, product: "AutoCount Accounting", steps: ["Step one"] }).select("code").single();
    seededGuide = guide.data?.code ?? null;
    const chat = await sb.from("accountant_chats").insert({ title: "[e2e] member chat" }).select("id").single();
    seededChat = chat.data?.id ?? null;
  });
});

test.afterAll(async () => {
  if (!allowWrites) return;
  // Chats are private, so the member deletes its own; the guide goes through e2e_cleanup().
  await e2eCleanup(async (sb) => void (await sb.from("accountant_chats").delete().like("title", "[e2e]%")));
});

const NEEDS_DATA = "the account has no %s: run with E2E_ALLOW_WRITES=1 (the spec then creates an [e2e] one) or seed one";

test("a guide page has Edit but no verify or delete", async ({ page }) => {
  if (seededGuide) await page.goto(`/guides/${seededGuide}`);
  else {
    await page.goto("/guides");
    const first = page.getByRole("link", { name: /^G-\d+/ }).first();
    test.skip((await first.count()) === 0, NEEDS_DATA.replace("%s", "guides"));
    await first.click();
  }
  await expect(page).toHaveURL(/\/guides\/G-\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark verified" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark unverified" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Unpin/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
});

test("Settings shows only deleted chats and the password card", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText("Deleted chats")).toBeVisible();
  await expect(page.getByRole("link", { name: "Change password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export to Excel" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Model" })).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByText("Deleted guides")).toHaveCount(0);
  await expect(page.getByText("Deleted Knowledge hub articles")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Clear .*search history/ })).toHaveCount(0);
});

test("the Accountant chat still lets a member rename and delete their own chats", async ({ page }) => {
  if (seededChat) await page.goto(`/chat/${seededChat}`);
  else {
    await page.goto("/chat");
    const chat = page.getByRole("main").locator('a[href^="/chat/"]').first();
    test.skip((await chat.count()) === 0, NEEDS_DATA.replace("%s", "saved chats"));
    await chat.click();
  }
  await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Rename" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
});

test("Knowledge articles show no review or delete controls", async ({ page }) => {
  await page.goto("/knowledge");
  const article = page.getByRole("main").locator('a[href^="/knowledge/"]:not([href$="/new"])').first();
  test.skip((await article.count()) === 0, "the Knowledge hub has no articles yet");
  await article.click();
  await expect(page).toHaveURL(/\/knowledge\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as reviewed" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("a member gets Not found at /team and sees no Team link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
  await page.goto("/team");
  await expect(page.getByText("That page or guide doesn’t exist")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for approval" })).toHaveCount(0);
});
