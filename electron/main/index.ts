import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import { ProcessManager } from "./process-manager";

let mainWindow: BrowserWindow | null = null;
const processManager = new ProcessManager();

process.on("uncaughtException", (err) => {
  console.error("[MAIN UNCAUGHT]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[MAIN UNHANDLED REJECTION]", reason);
});

function createWindow(): void {
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
    mainWindow!.show();
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

function setupIPC(): void {
  ipcMain.handle("get-versions", () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));

  ipcMain.handle("open-external", (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle("show-save-dialog", async (_event, opts: Electron.SaveDialogOptions) => {
    return await require("electron").dialog.showSaveDialog(opts);
  });
}

function forwardStatusToRenderer(): void {
  processManager.onStatus((status) => {
    mainWindow?.webContents.send("process-status", status);
  });
}

app.whenReady().then(async () => {
  app.name = "MIX";
  electronApp.setAppUserModelId("com.mix.desktop");

  setupIPC();
  createWindow();
  forwardStatusToRenderer();

  try {
    await processManager.startAll();
  } catch (err) {
    console.error("[STARTUP FAILED]", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    processManager.stopAll();
    app.quit();
  }
});

app.on("before-quit", () => {
  processManager.stopAll();
});
