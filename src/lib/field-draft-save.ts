import type { DescriptionBasis } from "./description-comparison";
import type { FieldDraft, FieldDrafts } from "./field-draft";
import type { DescriptionSaveResult } from "./jira/description-save";

type DraftStore = {
  getState: () => {
    drafts: FieldDrafts;
    beginSave: (id: string) => boolean;
    endSave: (id: string) => void;
    complete: (id: string, submitted: FieldDraft, basis?: DescriptionBasis) => boolean;
  };
};

export const submitFieldDraft = async (
  store: DraftStore,
  id: string,
  save: (draft: FieldDraft) => Promise<DescriptionSaveResult | { status: "saved" }>,
  lockId = id,
) => {
  const state = store.getState();
  const submitted = state.drafts[id];
  if (!submitted) return { status: "missing" } as const;
  if (!state.beginSave(lockId)) return { status: "busy" } as const;
  try {
    const result = await save(submitted);
    if (result.status !== "saved") return result;
    return { status: state.complete(id, submitted, "basis" in result ? result.basis : undefined) ? "saved" : "newer-draft" } as const;
  } finally {
    state.endSave(lockId);
  }
};
