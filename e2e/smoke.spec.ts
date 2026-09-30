import { expect, test } from "@playwright/test";

/** Every prototype screen, with a heading we expect to see. */
const routes: [string, RegExp][] = [
  ["/", /Guidelines/],
  ["/guides", /Guide library/],
  ["/guides/G-1051", /SQL Server/],
  ["/guides/new", /New guide/],
  ["/guides/import", /Import guides/],
  ["/search?q=server%20not%20found", /Search/],
  ["/analyst", /Accounting analyst/],
  ["/replies", /Reply generator/],
  ["/sop", /SOP builder/],
  ["/templates", /Templates/],
  ["/releases", /Versions & releases/],
  ["/settings", /Settings/],
];

for (const [path, heading] of routes) {
  test(`${path} renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    // No horizontal page scroll at any viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("unknown guide shows the not-found page", async ({ page }) => {
  await page.goto("/guides/G-9999");
  await expect(page.getByText("That page or guide doesn’t exist")).toBeVisible();
});

test("every preview state renders on the guide library", async ({ page, isMobile }) => {
  test.skip(isMobile, "state switcher checked on desktop");
  await page.goto("/guides");
  for (const [label, expected] of [
    ["Empty", "No guides yet"],
    ["Loading", null],
    ["Error", "Couldn’t load guides"],
    ["With data", "G-1051"],
  ] as const) {
    await page.getByRole("combobox", { name: /Preview state/ }).click();
    await page.getByRole("option", { name: label }).click();
    if (expected) await expect(page.getByText(expected).first()).toBeVisible();
    else await expect(page.getByLabel("Loading")).toBeVisible();
  }
});

test("analyst journal entries all balance", async ({ page }) => {
  await page.goto("/analyst");
  await expect(page.getByText("Dr = Cr")).toHaveCount(5);
  await expect(page.getByText("Does not balance")).toHaveCount(0);
});

test("upload rejects wrong file type", async ({ page }) => {
  await page.goto("/guides/new");
  await page.locator('input[type=file][multiple]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("this file type isn't supported")).toBeVisible();
});
