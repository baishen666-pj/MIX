import type { TranslationKey } from "./en";

const zh: Record<TranslationKey, string> = {
  /* Tab labels */
  "tab.chat": "聊天",
  "tab.skills": "技能",
  "tab.memory": "记忆",
  "tab.dashboard": "仪表盘",
  "tab.agents": "代理",
  "tab.tools": "工具",
  "tab.knowledge": "知识库",
  "tab.settings": "设置",

  /* Status */
  "status.on": "在线",
  "status.off": "离线",
  "status.loading": "加载中...",

  /* Buttons */
  "btn.send": "发送",
  "btn.delete": "删除",
  "btn.cancel": "取消",
  "btn.confirm": "确认",
  "btn.create": "创建",
  "btn.search": "搜索",
  "btn.install": "安装",
  "btn.uninstall": "卸载",
  "btn.update": "更新",
  "btn.run": "运行",
  "btn.start": "开始",
  "btn.refresh": "刷新",

  /* Errors */
  "error.fetchFailed": "获取失败",
  "error.engineUnreachable": "引擎不可达",
  "error.executionFailed": "执行失败",
  "error.requestFailed": "请求失败",
  "error.collaborationFailed": "协作失败",
  "error.deleteAgentFailed": "删除代理失败",
  "error.createAgentFailed": "创建代理失败",
  "error.fetchAgentsFailed": "获取代理失败",
  "error.installFailed": "安装失败",
  "error.uninstallFailed": "卸载失败",
  "error.updateFailed": "更新失败",

  /* Chat */
  "chat.placeholder": "输入消息... (Shift+Enter 换行)",
  "chat.emptyState": "发送消息开始对话",
  "chat.noSessions": "暂无会话",

  /* Skills */
  "skills.title": "技能",
  "skills.noSkills": "暂无技能",
  "skills.argsPlaceholder": "参数 (JSON 或文本)...",
  "skills.installTitle": "安装插件",
  "skills.installPlaceholder": "GitHub URL 或本地路径...",
  "skills.installedTitle": "已安装插件",
  "skills.noInstalled": "未安装插件",
  "skills.installing": "安装中...",
  "skills.uninstalling": "卸载中...",
  "skills.updating": "更新中...",

  /* Memory */
  "memory.searchPlaceholder": "搜索记忆...",

  /* Dashboard */
  "dashboard.title": "仪表盘",
  "dashboard.noHistory": "暂无执行历史",

  /* Agents */
  "agents.loading": "加载代理...",
  "agents.namePlaceholder": "代理名称",
  "agents.collabPlaceholder": "描述协作任务...",
  "agents.running": "运行中...",
  "agents.noPlans": "暂无协作计划。",
  "agents.stepProgress": "步骤进度",

  /* Tools */
  "tools.title": "工具",

  /* Knowledge */
  "knowledge.title": "知识库",

  /* Settings */
  "settings.title": "设置",

  /* Plugin */
  "plugin.source": "来源",
  "plugin.version": "版本",
  "plugin.description": "描述",
};

export default zh;
