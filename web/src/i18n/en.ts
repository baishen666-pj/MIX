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

  /* Empty States */
  "empty.noResults": "No results",
  "empty.tryDifferent": "Try a different search term",
  "empty.startConversation": "Start a conversation to see sessions here",
  "empty.noHistoryYet": "No execution history yet",
  "empty.historyWillAppear": "Tool executions will appear here as they are used",
  "empty.noChains": "No chain executions recorded yet",
  "empty.chainsWillAppear": "Multi-step tool chains will appear here",
  "empty.noPending": "No pending approvals",
  "empty.allHandled": "All tool requests have been handled",
  "empty.loadingSkills": "Loading skills...",
  "empty.skillsLoading": "Please wait while skills are loaded",
  "empty.installPlugin": "Install a plugin or configure skills to get started",

  /* Sidebar */
  "sidebar.sessions": "Sessions",
  "sidebar.newSession": "New session",
  "sidebar.expandSidebar": "Expand sidebar",
  "sidebar.collapseSidebar": "Collapse sidebar",
  "sidebar.searchSessions": "Search sessions...",
  "sidebar.exportSession": "Export session",
  "sidebar.exportAsMarkdown": "Export as Markdown",
  "sidebar.deleteSession": "Delete session",

  /* Tools */
  "tools.history": "History",
  "tools.chains": "Chains",
  "tools.approval": "Approval",
  "tools.totalExecutions": "Total Executions",
  "tools.successRate": "Success Rate",
  "tools.avgTime": "Avg Time",
  "tools.approve": "Approve",
  "tools.reject": "Reject",
  "tools.safe": "safe",
  "tools.moderate": "moderate",
  "tools.dangerous": "dangerous",

  /* Agents */
  "agents.createAgent": "Create Agent",
  "agents.startCollab": "Start Collaboration",
  "agents.selectRole": "Select role",
  "agents.pattern": "Pattern",

  /* Knowledge */
  "knowledge.collections": "Collections",
  "knowledge.documents": "Documents",
  "knowledge.query": "Query",

  /* Dashboard */
  "dashboard.metrics": "Metrics",
  "dashboard.llmStats": "LLM Stats",
  "dashboard.systemHealth": "System Health",
} as const;

export type TranslationKey = keyof typeof en;
export default en;
