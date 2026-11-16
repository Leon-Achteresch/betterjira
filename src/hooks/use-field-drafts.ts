import { Schema } from "effect";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  FieldDrafts,
  clearSubmittedFieldDraft,
  isSubmittedFieldDraft,
  removeFieldDraft,
  replaceFieldDraft,
  rebaseNewerFieldDraft,
  type FieldDraft,
} from "@/lib/field-draft";
import type { DescriptionBasis } from "@/lib/description-comparison";

type FieldDraftState = {
  drafts: FieldDrafts;
  saving: readonly string[];
  write: (id: string, text: string, basis?: DescriptionBasis) => void;
  discard: (id: string) => void;
  complete: (id: string, submitted: FieldDraft, savedBasis?: DescriptionBasis) => boolean;
  beginSave: (id: string) => boolean;
  endSave: (id: string) => void;
};

const PersistedDrafts = Schema.Struct({ drafts: FieldDrafts });

export const useFieldDraftStore = create<FieldDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      saving: [],
      write: (id, text, basis) => set(({ drafts }) => ({ drafts: replaceFieldDraft(drafts, id, text, crypto.randomUUID(), basis) })),
      discard: (id) => set(({ drafts }) => ({ drafts: removeFieldDraft(drafts, id) })),
      complete: (id, submitted, savedBasis) => {
        if (!isSubmittedFieldDraft(get().drafts[id], submitted)) {
          set(({ drafts }) => ({ drafts: rebaseNewerFieldDraft(drafts, id, submitted, savedBasis) }));
          return false;
        }
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
