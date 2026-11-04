import { Schema } from "effect";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  FieldDrafts,
  clearSubmittedFieldDraft,
  isSubmittedFieldDraft,
  removeFieldDraft,
  replaceFieldDraft,
  type FieldDraft,
} from "@/lib/field-draft";

type FieldDraftState = {
  drafts: FieldDrafts;
  saving: readonly string[];
  write: (id: string, text: string) => void;
  discard: (id: string) => void;
  complete: (id: string, submitted: FieldDraft) => boolean;
  beginSave: (id: string) => boolean;
  endSave: (id: string) => void;
};

const PersistedDrafts = Schema.Struct({ drafts: FieldDrafts });

export const useFieldDraftStore = create<FieldDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      saving: [],
      write: (id, text) => set(({ drafts }) => ({ drafts: replaceFieldDraft(drafts, id, text, crypto.randomUUID()) })),
      discard: (id) => set(({ drafts }) => ({ drafts: removeFieldDraft(drafts, id) })),
      complete: (id, submitted) => {
        if (!isSubmittedFieldDraft(get().drafts[id], submitted)) return false;
        set(({ drafts }) => ({ drafts: clearSubmittedFieldDraft(drafts, id, submitted) }));
        return true;
      },
      beginSave: (id) => {
        if (get().saving.includes(id)) return false;
        set(({ saving }) => ({ saving: [...saving, id] }));
        return true;
      },
      endSave: (id) => set(({ saving }) => ({ saving: saving.filter((entry) => entry !== id) })),
    }),
    {
      name: "betterjira-field-drafts",
      partialize: ({ drafts }) => ({ drafts }),
      merge: (persisted, current) =>
        Schema.is(PersistedDrafts)(persisted) ? { ...current, drafts: persisted.drafts } : current,
    },
  ),
);
