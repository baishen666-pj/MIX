import { create } from "zustand";
import type { Message, MemoryEntry } from "./types";

interface AppState {
  // Navigation
  tab: string;
  setTab: (tab: string) => void;

  // Chat
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  connected: boolean;
  setConnected: (connected: boolean) => void;
  thinking: boolean;
  setThinking: (thinking: boolean) => void;
  ttfb: number | null;
  setTtfb: (ms: number | null) => void;

  // Theme
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;

  // Locale
  locale: "en" | "zh";
  setLocale: (locale: "en" | "zh") => void;

  // API
  apiError: string | null;
  setApiError: (error: string | null) => void;

  // Memory
  memories: MemoryEntry[];
  setMemories: (memories: MemoryEntry[]) => void;
}

const getInitialTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("mix-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
};

const getInitialLocale = (): "en" | "zh" => {
  if (typeof window === "undefined") return "zh";
  const stored = localStorage.getItem("mix-locale");
  if (stored === "en" || stored === "zh") return stored;
  return "zh";
};

export const useStore = create<AppState>((set) => ({
  tab: "chat",
  setTab: (tab) => set({ tab }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  sessionId: "",
  setSessionId: (sessionId) => set({ sessionId }),
  connected: false,
  setConnected: (connected) => set({ connected }),
  thinking: false,
  setThinking: (thinking) => set({ thinking }),
  ttfb: null,
  setTtfb: (ttfb) => set({ ttfb }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mix-theme", theme);
    set({ theme });
  },

  locale: getInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem("mix-locale", locale);
    set({ locale });
  },

  apiError: null,
  setApiError: (apiError) => set({ apiError }),

  memories: [],
  setMemories: (memories) => set({ memories }),
}));
