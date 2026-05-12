import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type BaileysEventMap,
  type WAMessage,
  type proto,
} from "@whiskeysockets/baileys";
import * as path from "path";
import * as fs from "fs";
import type { ChannelAdapter, ChannelMessage } from "./types.js";
import { logger } from "../utils/logger.js";

type MessageHandler = (msg: ChannelMessage) => void;

export interface WhatsAppConfig {
  authDir?: string;
}

const DEFAULT_AUTH_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".mix", "data", "whatsapp-auth");

export class WhatsAppChannel implements ChannelAdapter {
  readonly name = "whatsapp" as const;
  private handlers: MessageHandler[] = [];
  private config: WhatsAppConfig;
  private sock: WASocket | null = null;
  private running = false;

  constructor(config: WhatsAppConfig = {}) {
    this.config = config;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers = [...this.handlers, handler];
  }

  async start(): Promise<void> {
    this.running = true;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
    this.handlers = [];
  }

  async send(msg: ChannelMessage): Promise<void> {
    if (!this.sock) return;
    const jid = msg.metadata.waJid as string;
    if (!jid) return;

    await this.sock.sendMessage(jid, { text: msg.content });
  }

  private async connect(): Promise<void> {
    const authDir = this.config.authDir ?? DEFAULT_AUTH_DIR;
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
    });

    this.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info("WhatsApp: Scan the QR code above to pair");
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect && this.running) {
          setTimeout(() => this.connect(), 3000);
        } else {
          logger.info("WhatsApp: Logged out, stopping reconnection");
          this.running = false;
        }
      } else if (connection === "open") {
        logger.info("WhatsApp: Connected");
      }
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("messages.upsert", (evt: BaileysEventMap["messages.upsert"]) => {
      if (evt.type !== "notify") return;

      for (const waMsg of evt.messages) {
        const channelMsg = this.toChannelMessage(waMsg);
        if (channelMsg) {
          for (const handler of this.handlers) {
            handler(channelMsg);
          }
        }
      }
    });
  }

  private toChannelMessage(waMsg: WAMessage): ChannelMessage | null {
    if (!waMsg.key || waMsg.key.fromMe) return null;

    const content = this.extractText(waMsg);
    if (!content) return null;

    const jid = waMsg.key.remoteJid ?? "";
    const senderId = waMsg.key.participant ?? jid;
    const pushName = (waMsg.pushName as string) ?? "";

    return {
      id: `wa-${waMsg.key.id ?? Date.now()}`,
      channel: "whatsapp",
      userId: senderId,
      content,
      metadata: {
        waJid: jid,
        waPushName: pushName,
        waParticipant: waMsg.key.participant ?? null,
        isGroup: jid.endsWith("@g.us"),
      },
      timestamp: waMsg.messageTimestamp
        ? new Date(typeof waMsg.messageTimestamp === "number" ? waMsg.messageTimestamp * 1000 : Date.now()).toISOString()
        : new Date().toISOString(),
    };
  }

  private extractText(waMsg: WAMessage): string | null {
    const msg = waMsg.message as proto.IMessage | undefined;
    if (!msg) return null;

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;

    return null;
  }
}
