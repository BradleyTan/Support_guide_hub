import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { allowWrites, hasTestAccount } from "./helpers";

/**
 * Accountant chat. Groq is never called: the ask-accountant Edge Function is stubbed in the browser. Read-only tests
 * stop before an answer is saved; the write tests save chats titled "[e2e] …" and remove them afterwards.
 */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

const fixture = JSON.parse(readFileSync("tests/fixtures/accountant/answer-ok.json", "utf8"));
const okAnswer = {
  answer: fixture,
  entryResults: [{ balanced: true, problem: null }],
  steps: [
    { ...fixture.steps[0], status: "confirmed" },
    { ...fixture.steps[1], status: "not-confirmed" },
  ],
  customerReply:
    "Your bank deducted RM10 from the payment. We'll record the RM10 as bank charges so invoice IV-00123 is fully settled.\n\nDr Bank RM990.00\nDr Bank charges RM10.00\nCr Trade debtor - [COMPANY 1] RM1,000.00",
  sources: [{ id: "S1", kind: "official", title: "Receive payment", url: "https://help.accounting.autocountcloud.com/support/solutions/articles/1-x", platform: "cloud", checked: true }],
  flags: [],
};
const questionsOnly = {
  answer: { ...fixture, needsMoreInfo: true, questions: ["Where did the RM5,000 go when it was banked?", "Is that financial year closed or audited?"], entries: [], steps: [], customerMessage: "" },
  entryResults: [],
  steps: [],
  customerReply: null,
  sources: [],
  flags: [],
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

/** Answers ask-accountant calls in the browser; returns the request bodies it saw. */
async function stubAsk(page: Page, reply: (body: { mask: Record<string, string> }) => { status: number; json: unknown }) {
  const bodies: { message: string; history: unknown[]; mask: Record<string, string> }[] = [];
  await page.route("**/functions/v1/ask-accountant", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: CORS });
    const body = route.request().postDataJSON();
    bodies.push(body);
    const r = reply(body);
    await route.fulfill({ status: r.status, headers: CORS, contentType: "application/json", body: JSON.stringify(r.json) });
  });
  return bodies;
}

async function preview(page: Page, text: string) {
  await page.goto("/chat");
  await page.getByLabel("Customer’s scenario").fill(text);
  await page.getByRole("button", { name: "Preview what’s sent" }).click();
  return page.getByLabel("What Groq will receive");
}

test.describe("read-only", () => {
  test("masks before sending; a busy free limit keeps the message", async ({ page }) => {
    const text = "Lee Trading Sdn Bhd (IC 900101-14-5678) paid a RM5,000 deposit. Mr Tan wants to knock it off.";
    const box = await preview(page, text);
    await expect(box).toContainText("[COMPANY 1]");
    await expect(box).toContainText("[IC 1]");
    await expect(box).not.toContainText("900101");

    // Hide a person's name by selecting it in the preview.
    await box.evaluate((el) => {
      const node = el.firstChild!;
      const start = node.textContent!.indexOf("Mr Tan");
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + "Mr Tan".length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
    });
    await page.getByRole("button", { name: "Hide selected text" }).click();
    await expect(box).toContainText("[HIDDEN 1]");

    const bodies = await stubAsk(page, () => ({ status: 429, json: { error: "rate_limited", retryAfter: 42 } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Groq's free limit is busy — try again in 42 seconds" })).toBeVisible();
    await expect(page.getByLabel("Customer’s scenario")).toHaveValue(text);
    expect(bodies).toHaveLength(1);
    for (const real of ["Lee Trading", "900101", "Mr Tan"]) expect(bodies[0].message).not.toContain(real);
  });

  test("bad answer keeps the message", async ({ page }) => {
    await preview(page, "Customer short-paid RM10 because of bank charges.");
    await stubAsk(page, () => ({ status: 502, json: { error: "bad_answer" } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "couldn't be checked" })).toBeVisible();
    await expect(page.getByLabel("Customer’s scenario")).toHaveValue("Customer short-paid RM10 because of bank charges.");
  });

  test("a missing Groq key is explained", async ({ page }) => {
    await preview(page, "Customer short-paid RM10.");
    await stubAsk(page, () => ({ status: 503, json: { error: "not_configured" } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "GROQ_API_KEY" })).toBeVisible();
  });
});

test("settings has the Accountant chat card", async ({ page }) => {
  await page.goto("/settings");
  const card = page.getByRole("region", { name: "Accountant chat" });
  await expect(card.getByRole("textbox", { name: "Model" })).toHaveValue(/\S/);
  await expect(card.getByRole("switch", { name: "Use web search when my sources don’t cover it" })).toBeVisible();
  await expect(card.getByText("Deleted chats")).toBeVisible();
});

test.describe("saving (writes data)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
  test.skip(!allowWrites, "Set E2E_ALLOW_WRITES=1 to run tests that save data");

  test.afterAll(async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    await sb.from("accountant_chats").delete().like("title", "[e2e]%");
    await sb.from("guides").delete().like("title", "[e2e]%");
    await sb.auth.signOut({ scope: "local" });
  });

  test("answer shows For you / For the customer and copy needs the tick; the chat is saved, renamed, deleted and restored", async ({ page }) => {
    await preview(page, "[e2e] Lee Trading Sdn Bhd paid RM990 for a RM1,000 invoice; their bank took RM10.");
    await stubAsk(page, (body) => ({ status: 200, json: { checked: okAnswer, mask: body.mask } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);

    const answer = page.getByRole("article", { name: "Answer" });
    await expect(answer.getByText("Check before relying")).toBeVisible();
    await expect(answer.getByRole("region", { name: "For you" })).toContainText("Bank charges");
    await expect(answer.getByText("Not confirmed")).toBeVisible();
    const forCustomer = answer.getByRole("region", { name: "For the customer" });
    await expect(forCustomer).toContainText("Cr Trade debtor - Lee Trading Sdn Bhd RM1,000.00");
    await expect(forCustomer.getByRole("button", { name: "Copy for the customer" })).toHaveCount(0);
    await forCustomer.getByRole("checkbox", { name: "I’ve checked the entry and steps" }).check();
    await expect(forCustomer.getByRole("button", { name: "Copy for the customer" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "I’ve checked the entry and steps" })).toBeChecked();

    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Chat name").fill("[e2e] renamed chat");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] renamed chat" })).toBeVisible();
    const url = page.url();

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Move to bin" }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] renamed chat" })).toBeVisible();
  });

  test("questions-only answer shows no customer reply", async ({ page }) => {
    await preview(page, "[e2e] Old deposit never recorded; customer wants to knock it off last month's invoice.");
    await stubAsk(page, (body) => ({ status: 200, json: { checked: questionsOnly, mask: body.mask } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
    await expect(page.getByText("A few questions first")).toBeVisible();
    await expect(page.getByText("Is that financial year closed or audited?")).toBeVisible();
    await expect(page.getByRole("region", { name: "For the customer" })).toHaveCount(0);
  });

  test("save as guide prefills the form with only confirmed steps", async ({ page }) => {
    await preview(page, "[e2e] Customer paid RM990 for a RM1,000 invoice; the bank took RM10.");
    await stubAsk(page, (body) => ({ status: 200, json: { checked: okAnswer, mask: body.mask } }));
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
    await page.getByRole("link", { name: "Save as guide" }).click();
    await expect(page).toHaveURL(/\/guides\/new\?fromChat=/);
    await expect(page.getByLabel("Title")).toHaveValue(/bank deducted RM10|customer's bank deducted RM10/i);
    await expect(page.getByLabel("Fix steps")).toHaveValue(/Sales > Receive Payment/);
    await expect(page.getByLabel("Fix steps")).not.toHaveValue(/A\/R > A\/R Payment/);
    await expect(page.getByLabel("Symptom")).toHaveValue(/paid RM990/);
  });
});
