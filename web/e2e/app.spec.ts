import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mix-locale", "en"));
});

test.describe("MIX Web UI", () => {
  test("loads and shows MIX title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".mix-header h1")).toHaveText("MIX");
  });

  test("shows connection status indicator", async ({ page }) => {
    await page.goto("/");
    const status = page.locator(".mix-header span").first();
    await expect(status).toBeVisible();
  });

  test("has all navigation tabs", async ({ page }) => {
    await page.goto("/");
    const tabs = page.locator(".mix-header nav button");
    await expect(tabs).toHaveCount(8);
    await expect(tabs.nth(0)).toHaveText(/Chat/);
    await expect(tabs.nth(1)).toHaveText(/Skills/);
    await expect(tabs.nth(2)).toHaveText(/Memory/);
    await expect(tabs.nth(3)).toHaveText(/Dashboard/);
    await expect(tabs.nth(4)).toHaveText(/Agents/);
    await expect(tabs.nth(5)).toHaveText(/Tools/);
    await expect(tabs.nth(6)).toHaveText(/Knowledge/);
    await expect(tabs.nth(7)).toHaveText(/Settings/);
  });

  test("switches between tabs", async ({ page }) => {
    await page.goto("/");

    await page.locator(".mix-header nav button", { hasText: /Skills/ }).click();
    await expect(page.locator("h2")).toHaveText("Skills");

    await page.locator(".mix-header nav button", { hasText: /Memory/ }).click();
    await expect(page.locator("h2").first()).toHaveText("Memory");

    await page.locator(".mix-header nav button", { hasText: /Settings/ }).click();
    await expect(page.getByText("Gateway", { exact: false })).toBeVisible();
  });

  test("has chat input on default tab", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", /Type a message/);
  });

  test("has theme toggle", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.locator("button[aria-label='Toggle theme']");
    await expect(themeBtn).toBeVisible();
  });

  test("sidebar is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Sessions").first()).toBeVisible({ timeout: 10000 });
  });
});
