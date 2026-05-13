import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { electronApp, is } from "@electron-toolkit/utils";
import { ProcessManager } from "./process-manager";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const processManager = new ProcessManager();

process.on("uncaughtException", (err) => {
  console.error("[MAIN UNCAUGHT]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[MAIN UNHANDLED REJECTION]", reason);
});

function createSplashWindow(): BrowserWindow {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { sandbox: true },
  });

  splashWindow.loadFile(join(__dirname, "../resources/splash.html"));
  splashWindow.on("ready-to-show", () => splashWindow?.show());
  splashWindow.on("closed", () => { splashWindow = null; });
  return splashWindow;
}

function sendToSplash(status: string, isError?: boolean): void {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.executeJavaScript(`
    document.getElementById('status').textContent = ${JSON.stringify(status)};
    ${isError ? `document.getElementById('error').textContent = ${JSON.stringify(status)};
                 document.getElementById('error').style.display = 'block';
                 document.getElementById('spinner').style.display = 'none';` : ''}
  `).catch(() => { /* splash may have closed */ });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow!.show();
  });

  mainWindow.on("close", (e) => {
    if (process.platform === "darwin") {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[CRASH] Renderer process gone:", details.reason, details.exitCode);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function setupTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show MIX", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { processManager.stopAll(); app.quit(); } },
  ]);
  tray.setToolTip("MIX Agent");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

function setupIPC(): void {
  const { dialog: dlg } = require("electron") as { dialog: typeof dialog };

  // Versions
  ipcMain.handle("get-versions", () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));

  // External links
  ipcMain.handle("open-external", (_event, url: string) => {
    shell.openExternal(url);
  });

  // File dialogs
  ipcMain.handle("show-save-dialog", async (_event, opts: Electron.SaveDialogOptions) => {
    return await dlg.showSaveDialog(mainWindow!, opts);
  });

  ipcMain.handle("show-open-dialog", async (_event, opts: Electron.OpenDialogOptions) => {
    return await dlg.showOpenDialog(mainWindow!, opts);
  });

  // Message box
  ipcMain.handle("show-message-box", async (_event, opts: Electron.MessageBoxOptions) => {
    return await dlg.showMessageBox(mainWindow!, opts);
  });

  // Config file management
  const configPath = join(homedir(), ".mix", "config.json");

  ipcMain.handle("read-local-config", () => {
    try {
      if (!existsSync(configPath)) return null;
      return JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      return null;
    }
  });

  ipcMain.handle("write-local-config", (_event, config: Record<string, unknown>) => {
    try {
      const dir = join(homedir(), ".mix");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("get-config-path", () => configPath);
  ipcMain.handle("get-mix-home", () => join(homedir(), ".mix"));

  // Process control
  ipcMain.handle("restart-services", async () => {
    processManager.stopAll();
    try {
      await processManager.startAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("is-services-ready", () => processManager.isReady());
}

function forwardStatusToRenderer(): void {
  processManager.onStatus((status) => {
    if (status.phase === "starting") {
      sendToSplash(status.message);
    } else if (status.phase === "error") {
      sendToSplash(status.message, true);
    }
    mainWindow?.webContents.send("process-status", status);
  });
}

app.whenReady().then(async () => {
  app.name = "MIX";
  electronApp.setAppUserModelId("com.mix.desktop");

  setupIPC();
  createSplashWindow();
  forwardStatusToRenderer();
  if (process.platform !== "darwin") {
    setupTray();
  }

  try {
    await processManager.startAll();
    createMainWindow();
  } catch (err) {
    console.error("[STARTUP FAILED]", err);
    sendToSplash(`Startup failed: ${(err as Error).message}`, true);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    processManager.stopAll();
    tray?.destroy();
    app.quit();
  }
});

app.on("before-quit", () => {
  processManager.stopAll();
  tray?.destroy();
});
