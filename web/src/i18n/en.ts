const en = {
  /* Tab labels */
  "tab.chat": "Chat",
  "tab.skills": "Skills",
  "tab.memory": "Memory",
  "tab.dashboard": "Dashboard",
  "tab.agents": "Agents",
  "tab.tools": "Tools",
  "tab.knowledge": "Knowledge",
  "tab.settings": "Settings",

  /* Status */
  "status.on": "on",
  "status.off": "off",
  "status.loading": "Loading...",

  /* Buttons */
  "btn.send": "Send",
  "btn.delete": "Delete",
  "btn.cancel": "Cancel",
  "btn.confirm": "Confirm",
  "btn.create": "Create",
  "btn.search": "Search",
  "btn.install": "Install",
  "btn.uninstall": "Uninstall",
  "btn.update": "Update",
  "btn.run": "Run",
  "btn.start": "Start",
  "btn.refresh": "Refresh",

  /* Errors */
  "error.fetchFailed": "Failed to fetch",
  "error.engineUnreachable": "Engine unreachable",
  "error.executionFailed": "Execution failed",
  "error.requestFailed": "Request failed",
  "error.collaborationFailed": "Collaboration failed",
  "error.deleteAgentFailed": "Failed to delete agent",
  "error.createAgentFailed": "Failed to create agent",
  "error.fetchAgentsFailed": "Failed to fetch agents",
  "error.installFailed": "Install failed",
  "error.uninstallFailed": "Uninstall failed",
  "error.updateFailed": "Update failed",

  /* Chat */
  "chat.placeholder": "Type a message... (Shift+Enter for new line)",
  "chat.emptyState": "Send a message to start",
  "chat.noSessions": "No sessions yet",

  /* Skills */
  "skills.title": "Skills",
  "skills.noSkills": "No skills loaded",
  "skills.argsPlaceholder": "Arguments (JSON or text)...",
  "skills.installTitle": "Install Plugin",
  "skills.installPlaceholder": "GitHub URL or local path...",
  "skills.installedTitle": "Installed Plugins",
  "skills.noInstalled": "No plugins installed",
  "skills.installing": "Installing...",
  "skills.uninstalling": "Uninstalling...",
  "skills.updating": "Updating...",

  /* Memory */
  "memory.searchPlaceholder": "Search memories...",

  /* Dashboard */
  "dashboard.title": "Dashboard",
  "dashboard.noHistory": "No execution history",

  /* Agents */
  "agents.loading": "Loading agents...",
  "agents.namePlaceholder": "Agent name",
  "agents.collabPlaceholder": "Describe the task for collaboration...",
  "agents.running": "Running...",
  "agents.noPlans": "No collaboration plans yet.",
  "agents.stepProgress": "Step Progress",

  /* Tools */
  "tools.title": "Tools",

  /* Knowledge */
  "knowledge.title": "Knowledge",

  /* Settings */
  "settings.title": "Settings",

  /* Plugin */
  "plugin.source": "Source",
  "plugin.version": "Version",
  "plugin.description": "Description",
} as const;

export type TranslationKey = keyof typeof en;
export default en;
