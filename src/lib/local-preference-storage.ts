import { Schema } from "effect";
import type { StateStorage } from "zustand/middleware";

const StorageEnvelope = Schema.Struct({ state: Schema.Unknown });

export const LOCAL_PREFERENCE_STORAGE: StateStorage = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      return Schema.is(StorageEnvelope)(parsed) ? raw : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (window.localStorage.getItem(name) !== value) window.localStorage.setItem(name, value);
    } catch {
      return;
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      return;
    }
  },
};
