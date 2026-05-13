import * as net from "net";
import * as tls from "tls";
import { BaseChannel } from "./base.js";
import type { ChannelMessage } from "./types.js";

export interface IrcConfig {
  server: string;
  port?: number;
  nick: string;
  channels: string[];
  password?: string;
  tls?: boolean;
}

interface IrcMessage {
  prefix?: string;
  command: string;
  params: string[];
}

function parseIrcLine(line: string): IrcMessage {
  let rest = line;
  let prefix: string | undefined;

  if (rest.startsWith(":")) {
    const spaceIdx = rest.indexOf(" ");
    prefix = rest.substring(1, spaceIdx);
    rest = rest.substring(spaceIdx + 1);
  }

  const spaceIdx = rest.indexOf(" ");
  const command = spaceIdx === -1 ? rest : rest.substring(0, spaceIdx);
  rest = spaceIdx === -1 ? "" : rest.substring(spaceIdx + 1);

  const params: string[] = [];
  while (rest.length > 0) {
    if (rest.startsWith(":")) {
      params.push(rest.substring(1));
      break;
    }
    const idx = rest.indexOf(" ");
    if (idx === -1) {
      params.push(rest);
      break;
    }
    params.push(rest.substring(0, idx));
    rest = rest.substring(idx + 1);
  }

  return { prefix, command, params };
}

function extractNick(prefix: string): string {
  const bang = prefix.indexOf("!");
  return bang === -1 ? prefix : prefix.substring(0, bang);
}

export class IrcChannel extends BaseChannel {
  readonly name = "irc" as const;
  private config: IrcConfig;
  private socket: net.Socket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: IrcConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.server || !this.config.nick) return;
    this.connect();
  }

  async stop(): Promise<void> {
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.sendRaw("QUIT :MIX bot shutting down");
      this.socket.destroy();
      this.socket = null;
    }
    await super.stop();
  }

  async send(msg: ChannelMessage): Promise<void> {
    const rawTarget = msg.metadata.ircTarget as string | undefined;
    if (!rawTarget || !this.socket) return;
    const target = this.sanitizeIrcParam(rawTarget);

    const lines = msg.content.split("\n");
    for (const line of lines) {
      const sanitized = this.sanitizeIrcParam(line);
      if (sanitized.trim()) {
        this.sendRaw(`PRIVMSG ${target} :${sanitized}`);
      }
    }
  }

  private connect(): void {
    const port = this.config.port ?? (this.config.tls ? 6697 : 6667);

    if (this.config.tls) {
      this.socket = tls.connect({ host: this.config.server, port }, () => {
        this.onConnect();
      });
    } else {
      this.socket = net.createConnection({ host: this.config.server, port }, () => {
        this.onConnect();
      });
    }

    let buffer = "";
    this.socket.on("data", (data: Buffer) => {
      buffer += data.toString("utf-8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) {
          this.handleLine(line);
        }
      }
    });

    this.socket.on("close", () => {
      if (this.connected && this.handlers.length > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    });

    this.socket.on("error", () => {
      // Reconnect handled by close event
    });
  }

  private onConnect(): void {
    this.connected = true;
    if (this.config.password) {
      this.sendRaw(`PASS ${this.config.password}`);
    }
    this.sendRaw(`NICK ${this.config.nick}`);
    this.sendRaw(`USER ${this.config.nick} 0 * :MIX Bot`);
  }

  private handleLine(line: string): void {
    const msg = parseIrcLine(line);

    if (msg.command === "PING") {
      this.sendRaw(`PONG :${msg.params[0] ?? ""}`);
      return;
    }

    if (msg.command === "001") {
      for (const channel of this.config.channels) {
        this.sendRaw(`JOIN ${channel}`);
      }
      return;
    }

    if (msg.command === "PRIVMSG" && msg.prefix) {
      const senderNick = extractNick(msg.prefix);
      if (senderNick === this.config.nick) return;

      const target = msg.params[0];
      const content = msg.params.slice(1).join(" ");
      if (!content) return;

      const isDm = !target.startsWith("#");
      const replyTarget = isDm ? senderNick : target;

      const channelMsg: ChannelMessage = {
        id: `irc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel: "irc",
        userId: senderNick,
        content,
        metadata: {
          ircNick: senderNick,
          ircChannel: isDm ? null : target,
          ircTarget: replyTarget,
          isDm,
        },
        timestamp: new Date().toISOString(),
      };

      this.dispatch(channelMsg);
    }
  }

  private sendRaw(data: string): void {
    this.socket?.write(`${data}\r\n`);
  }

  private sanitizeIrcParam(param: string): string {
    return param.replace(/[\r\n\0]/g, "");
  }
}
