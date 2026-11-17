import type { Article } from "@/lib/zammad/model";
import { create } from "zustand";
import { appendSourceQuote } from "@/lib/zammad/source-quote";

type Draft = {
  reply: Article | null;
  body: string;
  kind: string;
  recipient: string | null;
  cc: string;
  subject: string | null;
  files: File[];
  quotedSources: readonly number[];
  revision: number;
};
const EMPTY_DRAFT: Draft = {
  reply: null,
  body: "",
  kind: "internal",
  recipient: null,
  cc: "",
  subject: null,
  files: [],
  quotedSources: [],
  revision: 0,
};
const useDraftStore = create<{
  drafts: Record<string, Draft>;
  update: (key: string, patch: Partial<Draft>) => void;
  complete: (key: string, sent: Draft) => void;
  quote: (key: string, sourceId: number, block: string) => void;
  clear: () => void;
}>((set) => ({
  drafts: {},
  quote: (key, sourceId, block) =>
    set((state) => {
      const draft = state.drafts[key] ?? EMPTY_DRAFT;
      const patch = appendSourceQuote(
        draft.body,
        draft.quotedSources,
        sourceId,
        block,
      );
      return patch
        ? {
            drafts: {
              ...state.drafts,
              [key]: { ...draft, ...patch, revision: draft.revision + 1 },
            },
          }
        : state;
    }),
  update: (key, patch) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [key]: {
          ...(state.drafts[key] ?? EMPTY_DRAFT),
          ...patch,
          revision: (state.drafts[key]?.revision ?? 0) + 1,
        },
      },
    })),
  complete: (key, sent) =>
    set((state) => {
      const current = state.drafts[key];
      if (!current) return state;
      const unchanged =
        current.revision === sent.revision &&
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
            quotedSources: unchanged ? [] : current.quotedSources,
            files: unchanged ? [] : current.files,
            revision: unchanged ? current.revision + 1 : current.revision,
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
  const quote = useDraftStore((state) => state.quote);
  return {
    ...draft,
    update: (patch: Partial<Draft>) => update(key, patch),
    complete: () => complete(key, draft),
    quote: (sourceId: number, block: string) => quote(key, sourceId, block),
  };
};
