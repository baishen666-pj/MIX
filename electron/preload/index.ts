import { contextBridge, ipcRenderer } from "electron";

const mixDesktop = {
  // Versions
  getVersions: (): Promise<{ app: string; electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke("get-versions"),

  // External links
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external", url),

  // File dialogs
  showSaveDialog: (opts: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke("show-save-dialog", opts),

  showOpenDialog: (opts: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke("show-open-dialog", opts),

  // Message box
  showMessageBox: (opts: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    ipcRenderer.invoke("show-message-box", opts),

  // Config management
  readLocalConfig: (): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke("read-local-config"),

  writeLocalConfig: (config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("write-local-config", config),

  getConfigPath: (): Promise<string> =>
    ipcRenderer.invoke("get-config-path"),

  getMixHome: (): Promise<string> =>
    ipcRenderer.invoke("get-mix-home"),

  // Process control
  restartServices: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("restart-services"),

  isServicesReady: (): Promise<boolean> =>
    ipcRenderer.invoke("is-services-ready"),

  // Event listeners
  onProcessStatus: (callback: (status: { phase: string; message: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { phase: string; message: string }) =>
      callback(status);
    ipcRenderer.on("process-status", handler);
    return () => ipcRenderer.removeListener("process-status", handler);
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("mixDesktop", mixDesktop);
} else {
  (window as unknown as Record<string, unknown>).mixDesktop = mixDesktop;
}
