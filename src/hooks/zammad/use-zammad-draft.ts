import type { Article } from "@/lib/zammad/model";
import { create } from "zustand";

type Draft = {
  reply: Article | null;
  body: string;
  kind: string;
  recipient: string | null;
  cc: string;
  subject: string | null;
  files: File[];
};
const EMPTY_DRAFT: Draft = {
  reply: null,
  body: "",
  kind: "internal",
  recipient: null,
  cc: "",
  subject: null,
  files: [],
};
const useDraftStore = create<{
  drafts: Record<string, Draft>;
  update: (key: string, patch: Partial<Draft>) => void;
  complete: (key: string, sent: Draft) => void;
  clear: () => void;
}>((set) => ({
  drafts: {},
  update: (key, patch) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: { ...(state.drafts[key] ?? EMPTY_DRAFT), ...patch },
      },
    })),
  complete: (key, sent) =>
    set((state) => {
      const current = state.drafts[key];
      if (!current) return state;
      const unchanged =
        current.body.trim() === sent.body.trim() &&
        current.kind === sent.kind &&
        current.recipient === sent.recipient &&
        current.cc === sent.cc &&
        current.subject === sent.subject &&
        current.reply?.id === sent.reply?.id;
      return {
        drafts: {
          ...state.drafts,
          [key]: {
            ...current,
            body: unchanged ? "" : current.body,
            reply: unchanged ? null : current.reply,
            files: current.files === sent.files ? [] : current.files,
          },
        },
      };
    }),
  clear: () => set({ drafts: {} }),
}));
export const clearZammadDrafts = () => useDraftStore.getState().clear();
export const useZammadDraft = (key: string) => {
  const draft = useDraftStore((state) => state.drafts[key] ?? EMPTY_DRAFT);
  const update = useDraftStore((state) => state.update);
  const complete = useDraftStore((state) => state.complete);
  return {
    ...draft,
    update: (patch: Partial<Draft>) => update(key, patch),
    complete: () => complete(key, draft),
  };
};
