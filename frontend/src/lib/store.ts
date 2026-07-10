/**
 * Zustand stores for global state management.
 * Obsidian Logic — Single theme design system.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Auth Store ──
interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  organization_id?: string;
}

interface Organization {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, org?: Organization) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organization: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token, org) => set({ user, token, organization: org || null, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, organization: null, isAuthenticated: false }),
    }),
    { name: "auth-storage" }
  )
);

// ── Session Store ──
interface SessionState {
  sessionId: string;
  deviceId: string;
  lastActive: string;
  setSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      lastActive: new Date().toISOString(),
      setSession: (sessionId) => set({ sessionId, lastActive: new Date().toISOString() }),
    }),
    { name: "session-storage" }
  )
);

// ── Chat Store ──
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Array<{ index: number; content: string; score: number }>;
  agent_trace?: Array<{ agent: string; status: string; latency_ms: number }>;
  confidence_score?: number;
  timestamp: string;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  folder?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  selectedProvider: string;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setModel: (model: string) => void;
  setProvider: (provider: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  selectedModel: "gemini-2.0-flash",
  selectedProvider: "gemini",
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = { ...messages[messages.length - 1], content };
      }
      return { messages };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setModel: (selectedModel) => set({ selectedModel }),
  setProvider: (selectedProvider) => set({ selectedProvider }),
  clearMessages: () => set({ messages: [], activeConversationId: null }),
}));

// ── Sidebar Store ──
interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
}));

// ── Toast Store ──
export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "info", duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type, duration }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// ── Settings Store ──
export interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
  chunkSize: number;
  overlap: number;
  topK: number;
  similarityThreshold: number;
  enableSso: boolean;
  sessionTimeout: number;
  auditLogging: boolean;
  theme: "light" | "dark" | "midnight" | "cyberpunk" | "warm" | "apple";
}

interface SettingsState {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveSettings: (settings: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: "sk-••••••••••••3f7a",
  baseUrl: "https://api.neuralarch.ai/v1",
  model: "gemini-2.0-flash",
  chunkSize: 512,
  overlap: 64,
  topK: 10,
  similarityThreshold: 0.75,
  enableSso: true,
  sessionTimeout: 30,
  auditLogging: true,
  theme: "light",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),
      saveSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
    }),
    { name: "settings-storage" }
  )
);

