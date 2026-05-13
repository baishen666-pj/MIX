import { ChildProcess, spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { app } from "electron";
import http from "http";

const ENGINE_PORT = 18700;
const GATEWAY_PORT = 18789;

interface ManagedProcess {
  name: string;
  process: ChildProcess | null;
  port: number;
  ready: boolean;
}

function getEngineCommand(): { cmd: string; args: string[] } {
  if (app.isPackaged) {
    const engineExe = join(process.resourcesPath, "engine", "mix-engine");
    return { cmd: engineExe, args: [] };
  }
  const python = process.platform === "win32" ? "python" : "python3";
  const rootDir = join(__dirname, "..", "..", "..");
  return {
    cmd: python,
    args: [
      "-m", "uvicorn", "engine.main:app",
      "--host", "127.0.0.1",
      "--port", String(ENGINE_PORT),
    ],
  };
}

function getGatewayCommand(): { cmd: string; args: string[]; cwd: string } {
  const rootDir = join(__dirname, "..", "..", "..");
  const nodeBin = process.platform === "win32" ? "node.exe" : "node";

  if (app.isPackaged) {
    const gatewayScript = join(process.resourcesPath, "gateway", "index.js");
    return { cmd: nodeBin, args: [gatewayScript], cwd: rootDir };
  }
  const gatewayScript = join(rootDir, "gateway", "dist", "index.js");
  return { cmd: nodeBin, args: [gatewayScript], cwd: join(rootDir, "gateway") };
}

export class ProcessManager {
  private engine: ManagedProcess = { name: "engine", process: null, port: ENGINE_PORT, ready: false };
  private gateway: ManagedProcess = { name: "gateway", process: null, port: GATEWAY_PORT, ready: false };
  private statusCallback: ((status: ProcessStatus) => void) | null = null;
  private shuttingDown = false;

  onStatus(cb: (status: ProcessStatus) => void): void {
    this.statusCallback = cb;
  }

  private emit(status: ProcessStatus): void {
    this.statusCallback?.(status);
  }

  async startAll(): Promise<void> {
    this.shuttingDown = false;
    this.emit({ phase: "starting", message: "Starting Engine..." });

    await this.startEngine();
    this.emit({ phase: "starting", message: "Waiting for Engine to be ready..." });
    await this.waitForHealth(this.engine, 30000);
    this.engine.ready = true;
    this.emit({ phase: "starting", message: "Engine ready. Starting Gateway..." });

    await this.startGateway();
    this.emit({ phase: "starting", message: "Waiting for Gateway to be ready..." });
    await this.waitForHealth(this.gateway, 15000);
    this.gateway.ready = true;
    this.emit({ phase: "ready", message: "All services ready" });
  }

  stopAll(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.emit({ phase: "stopping", message: "Shutting down..." });
    this.killProcess(this.gateway);
    this.killProcess(this.engine);
    this.engine.ready = false;
    this.gateway.ready = false;
  }

  isReady(): boolean {
    return this.engine.ready && this.gateway.ready;
  }

  private startEngine(): Promise<void> {
    const rootDir = join(__dirname, "..", "..", "..");
    const { cmd, args } = getEngineCommand();

    this.engine.process = spawn(cmd, args.length ? args : [
      "--host", "127.0.0.1",
      "--port", String(ENGINE_PORT),
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: "pipe",
    });

    this.engine.process.stdout?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[engine] ${text}`);
    });

    this.engine.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.error(`[engine] ${text}`);
    });

    this.engine.process.on("close", (code) => {
      console.log(`[engine] exited with code ${code}`);
      this.engine.process = null;
      this.engine.ready = false;
      if (!this.shuttingDown) {
        this.emit({ phase: "error", message: `Engine crashed (exit code ${code})` });
      }
    });

    return Promise.resolve();
  }

  private startGateway(): Promise<void> {
    const { cmd, args, cwd } = getGatewayCommand();
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      MIX_ENGINE_HOST: "127.0.0.1",
      MIX_ENGINE_PORT: String(ENGINE_PORT),
      MIX_GATEWAY_HOST: "127.0.0.1",
      MIX_GATEWAY_PORT: String(GATEWAY_PORT),
      NODE_ENV: "production",
    };

    this.gateway.process = spawn(cmd, args, {
      cwd,
      env,
      stdio: "pipe",
    });

    this.gateway.process.stdout?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.log(`[gateway] ${text}`);
    });

    this.gateway.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      if (text) console.error(`[gateway] ${text}`);
    });

    this.gateway.process.on("close", (code) => {
      console.log(`[gateway] exited with code ${code}`);
      this.gateway.process = null;
      this.gateway.ready = false;
      if (!this.shuttingDown) {
        this.emit({ phase: "error", message: `Gateway crashed (exit code ${code})` });
      }
    });

    return Promise.resolve();
  }

  private waitForHealth(proc: ManagedProcess, timeoutMs: number): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = async () => {
        if (this.shuttingDown) {
          reject(new Error("Shutting down"));
          return;
        }
        const ok = await this.healthCheck(proc.port);
        if (ok) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`${proc.name} did not become healthy within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 1000);
        }
      };
      setTimeout(check, 1500);
    });
  }

  private healthCheck(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        `http://127.0.0.1:${port}/api/health`,
        { method: "GET", timeout: 2000 },
        (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        },
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  private killProcess(proc: ManagedProcess): void {
    if (!proc.process || proc.process.killed) return;
    try {
      proc.process.kill("SIGTERM");
    } catch { /* already dead */ }
    const pid = proc.process.pid;
    setTimeout(() => {
      try {
        if (pid) process.kill(pid, 0); // check if still alive
        proc.process?.kill("SIGKILL");
      } catch { /* already dead */ }
    }, 3000);
  }
}

export interface ProcessStatus {
  phase: "starting" | "ready" | "stopping" | "error";
  message: string;
}
