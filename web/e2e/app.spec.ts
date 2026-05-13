import { test, expect } from "@playwright/test";

test.describe("MIX Web UI", () => {
  test("loads and shows MIX title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("MIX");
  });

  test("shows connection status", async ({ page }) => {
    await page.goto("/");
    const status = page.locator("header span").first();
    await expect(status).toBeVisible();
  });

  test("has all navigation tabs", async ({ page }) => {
    await page.goto("/");
    const tabs = page.locator("header nav button");
    await expect(tabs).toHaveCount(8);
    await expect(tabs.nth(0)).toHaveText("chat");
    await expect(tabs.nth(1)).toHaveText("skills");
    await expect(tabs.nth(2)).toHaveText("memory");
    await expect(tabs.nth(3)).toHaveText("dashboard");
    await expect(tabs.nth(4)).toHaveText("agents");
    await expect(tabs.nth(5)).toHaveText("tools");
    await expect(tabs.nth(6)).toHaveText("knowledge");
    await expect(tabs.nth(7)).toHaveText("settings");
  });

  test("switches between tabs", async ({ page }) => {
    await page.goto("/");

    await page.locator("header nav button", { hasText: "skills" }).click();
    await expect(page.locator("h2")).toHaveText("Skills");

    await page.locator("header nav button", { hasText: "memory" }).click();
    await expect(page.locator("h2")).toHaveText("Memory");

    await page.locator("header nav button", { hasText: "settings" }).click();
    await expect(page.getByText("Gateway", { exact: false })).toBeVisible();
  });

  test("has chat input", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", /Type a message/);
  });

  test("has theme toggle", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.locator("header button[aria-label='Toggle theme']");
    await expect(themeBtn).toBeVisible();
  });

  test("memory search input exists", async ({ page }) => {
    await page.goto("/");
    await page.locator("header nav button", { hasText: "memory" }).click();
    const searchInput = page.locator("main input").first();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("placeholder", /Search memories/);
  });

  test("sidebar is visible", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("text=Sessions").first();
    await expect(sidebar).toBeVisible();
  });
});
