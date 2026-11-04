import { Schema } from "effect";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const RunOwners = Schema.Record(Schema.String, Schema.String);
const PersistedHistory = Schema.Struct({ owners: RunOwners });

type AttentionRunHistory = {
  owners: typeof RunOwners.Type;
  errors: Record<string, { runId: string; message: string }>;
  remember: (runId: string, scope: string) => void;
  fail: (scope: string, runId: string, message: string) => void;
};

export const useAttentionRunHistory = create<AttentionRunHistory>()(
  persist(
    (set) => ({
      owners: {},
      errors: {},
      remember: (runId, scope) =>
        set(({ owners, errors }) => {
          const { [scope]: previous, ...remainingErrors } = errors;
          return {
            owners: { ...Object.fromEntries(Object.entries(owners).slice(-99)), [runId]: scope },
            errors: remainingErrors,
          };
        }),
      fail: (scope, runId, message) => set(({ errors }) => ({ errors: { ...errors, [scope]: { runId, message } } })),
    }),
    {
      name: "betterjira-attention-runs",
      partialize: ({ owners }) => ({ owners }),
      merge: (persisted, current) =>
        Schema.is(PersistedHistory)(persisted) ? { ...current, owners: persisted.owners } : current,
    },
  ),
);
