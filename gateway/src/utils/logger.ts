type LogLevel = "debug" | "info" | "warn" | "error";

interface JsonLogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
  requestId?: string;
}

const useJson = process.env.LOG_FORMAT === "json";

let currentRequestId = "";

export function setRequestId(id: string): void {
  currentRequestId = id;
}

export function resetRequestId(): void {
  currentRequestId = "";
}

function timestamp(): string {
  return new Date().toISOString();
}

function logJson(level: LogLevel, msg: string, data?: unknown): void {
  const entry: JsonLogEntry = {
    timestamp: timestamp(),
    level,
    message: msg,
  };
  if (data !== undefined) {
    entry.data = data;
  }
  if (currentRequestId) {
    entry.requestId = currentRequestId;
  }
  console.log(JSON.stringify(entry));
}

function logText(level: LogLevel, msg: string, data?: unknown): void {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (data !== undefined) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
}

function log(level: LogLevel, msg: string, data?: unknown): void {
  if (useJson) {
    logJson(level, msg, data);
  } else {
    logText(level, msg, data);
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};
