import { ChannelRegistry } from "../channels/registry.js";
import { WebChatChannel } from "../channels/webchat.js";
import { TelegramChannel } from "../channels/telegram.js";
import { DiscordChannel } from "../channels/discord.js";
import { SlackChannel } from "../channels/slack.js";
import { WeChatChannel } from "../channels/wechat.js";
import { IrcChannel } from "../channels/irc.js";
import { WhatsAppChannel } from "../channels/whatsapp.js";
import { MatrixChannel } from "../channels/matrix.js";
import { LineChannel } from "../channels/line.js";
import { GoogleChatChannel } from "../channels/google-chat.js";
import { SignalChannel } from "../channels/signal.js";
import { TeamsChannel } from "../channels/teams.js";
import { IMessageChannel } from "../channels/imessage.js";
import { FeishuChannel } from "../channels/feishu.js";
import { logger } from "../utils/logger.js";

export function setupChannels(): { channels: ChannelRegistry; wechatAdapter?: WeChatChannel } {
  const channels = new ChannelRegistry();
  const webchat = new WebChatChannel();
  channels.register(webchat);

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken) {
    channels.register(new TelegramChannel({ botToken: telegramToken }));
    logger.info("Telegram channel enabled");
  }

  const discordToken = process.env.DISCORD_BOT_TOKEN;
  if (discordToken) {
    channels.register(new DiscordChannel({ botToken: discordToken }));
    logger.info("Discord channel enabled");
  }

  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    channels.register(new SlackChannel({ botToken: slackToken }));
    logger.info("Slack channel enabled");
  }

  const wechatWebhook = process.env.WECHAT_WEBHOOK_URL;
  let wechatAdapter: WeChatChannel | undefined;
  if (wechatWebhook) {
    wechatAdapter = new WeChatChannel({ webhookUrl: wechatWebhook });
    channels.register(wechatAdapter);
    logger.info("WeChat channel enabled");
  }

  const wechatCorpId = process.env.WECHAT_CORP_ID;
  const wechatAgentId = process.env.WECHAT_AGENT_ID;
  const wechatSecret = process.env.WECHAT_SECRET;
  if (!wechatWebhook && wechatCorpId && wechatAgentId && wechatSecret) {
    wechatAdapter = new WeChatChannel({ webhookUrl: "", corpId: wechatCorpId, agentId: wechatAgentId, secret: wechatSecret });
    channels.register(wechatAdapter);
    logger.info("WeChat app channel enabled");
  }

  const ircServer = process.env.IRC_SERVER;
  const ircNick = process.env.IRC_NICK;
  if (ircServer && ircNick) {
    const ircChannels = process.env.IRC_CHANNELS?.split(",").filter(Boolean) ?? [];
    channels.register(new IrcChannel({
      server: ircServer,
      nick: ircNick,
      channels: ircChannels,
      port: process.env.IRC_PORT ? parseInt(process.env.IRC_PORT, 10) : undefined,
      password: process.env.IRC_PASSWORD,
      tls: process.env.IRC_TLS === "true",
    }));
    logger.info("IRC channel enabled");
  }

  const whatsappEnabled = process.env.WHATSAPP_ENABLED === "true";
  if (whatsappEnabled) {
    channels.register(new WhatsAppChannel());
    logger.info("WhatsApp channel enabled");
  }

  const matrixServer = process.env.MATRIX_HOMESERVER;
  const matrixToken = process.env.MATRIX_ACCESS_TOKEN;
  if (matrixServer && matrixToken) {
    channels.register(new MatrixChannel({
      homeserverUrl: matrixServer,
      accessToken: matrixToken,
      userId: process.env.MATRIX_USER_ID ?? "",
      rooms: process.env.MATRIX_ROOMS?.split(",").filter(Boolean) ?? [],
    }));
    logger.info("Matrix channel enabled");
  }

  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (lineToken) {
    channels.register(new LineChannel({
      channelAccessToken: lineToken,
      channelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
    }));
    logger.info("LINE channel enabled");
  }

  const googleChatWebhook = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (googleChatWebhook) {
    channels.register(new GoogleChatChannel({ webhookUrl: googleChatWebhook }));
    logger.info("Google Chat channel enabled");
  }

  const signalServer = process.env.SIGNAL_SERVER_URL;
  if (signalServer) {
    channels.register(new SignalChannel({
      serverUrl: signalServer,
      phoneNumber: process.env.SIGNAL_PHONE_NUMBER ?? "",
    }));
    logger.info("Signal channel enabled");
  }

  const teamsBotId = process.env.TEAMS_BOT_ID;
  if (teamsBotId) {
    channels.register(new TeamsChannel({ botId: teamsBotId, botPassword: process.env.TEAMS_BOT_PASSWORD }));
    logger.info("Teams channel enabled");
  }

  const imessageBusinessId = process.env.IMESSAGE_BUSINESS_ID;
  if (imessageBusinessId) {
    channels.register(new IMessageChannel({ businessId: imessageBusinessId, apiEndpoint: process.env.IMESSAGE_API_ENDPOINT }));
    logger.info("iMessage channel enabled");
  }

  const feishuAppId = process.env.FEISHU_APP_ID;
  const feishuAppSecret = process.env.FEISHU_APP_SECRET;
  if (feishuAppId && feishuAppSecret) {
    channels.register(new FeishuChannel({ appId: feishuAppId, appSecret: feishuAppSecret }));
    logger.info("Feishu channel enabled");
  }

  return { channels, wechatAdapter };
}
