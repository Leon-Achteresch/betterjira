import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "betterjira-attention";

type AttentionSettingsState = {
  enabled: boolean;
  webhookUrl: string;
  intervalMinutes: number;
  token: string;
  pendingRunId: string | null;
  lastTriggeredAt: number | null;
  setEnabled: (enabled: boolean) => void;
  setWebhookUrl: (webhookUrl: string) => void;
  setIntervalMinutes: (intervalMinutes: number) => void;
  markTriggered: (runId: string) => void;
  clearPending: () => void;
};

export const useAttentionSettings = create<AttentionSettingsState>()(
  persist(
    (set) => ({
      enabled: false,
      webhookUrl: "",
      intervalMinutes: 30,
      token: crypto.randomUUID(),
      pendingRunId: null,
      lastTriggeredAt: null,
      setEnabled: (enabled) => set({ enabled }),
      setWebhookUrl: (webhookUrl) => set({ webhookUrl }),
      setIntervalMinutes: (intervalMinutes) => set({ intervalMinutes }),
      markTriggered: (runId) => set({ pendingRunId: runId, lastTriggeredAt: Date.now() }),
      clearPending: () => set({ pendingRunId: null }),
    }),
    { name: STORAGE_KEY },
  ),
);

if (!localStorage.getItem(STORAGE_KEY)) useAttentionSettings.setState({});

export const isAttentionConfigured = (state: AttentionSettingsState) => state.enabled && state.webhookUrl.trim() !== "";
