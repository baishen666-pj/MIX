import { test, expect, _electron as electron } from "@playwright/test";
import { join } from "path";

const ROOT = join(__dirname, "../..");

test.describe("MIX Electron Desktop", () => {
  let app: electron.ElectronApplication;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [join(ROOT, "electron/out/main/index.js")],
    });
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test("app launches and creates window", async () => {
    const window = await app.firstWindow();
    expect(window).toBeTruthy();
  });

  test("window has correct title", async () => {
    const window = await app.firstWindow();
    const title = await window.title();
    expect(title).toBeTruthy();
  });

  test("electron version is available", async () => {
    const version = app.evaluate(async ({ app }) => {
      return process.versions.electron;
    });
    const result = await version;
    expect(result).toMatch(/^\d+\.\d+/);
  });

  test("app name is MIX", async () => {
    const name = app.evaluate(async ({ app }) => {
      return app.getName();
    });
    const result = await name;
    expect(result).toBe("MIX");
  });

  test("is packaged returns false in dev", async () => {
    const packaged = app.evaluate(async ({ app }) => {
      return app.isPackaged;
    });
    const result = await packaged;
    expect(result).toBe(false);
  });

  test("main process does not crash", async () => {
    const isRunning = app.evaluate(async () => true);
    const result = await isRunning;
    expect(result).toBe(true);
  });
});
