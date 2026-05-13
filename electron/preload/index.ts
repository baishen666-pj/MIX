import { contextBridge, ipcRenderer } from "electron";

const mixDesktop = {
  getVersions: (): Promise<{ app: string; electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke("get-versions"),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external", url),

  showSaveDialog: (opts: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke("show-save-dialog", opts),

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
