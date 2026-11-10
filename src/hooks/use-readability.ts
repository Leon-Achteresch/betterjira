import { useLayoutEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_TEXT_SIZE,
  READABILITY_STORAGE_KEY,
  READABILITY_STORAGE_VERSION,
  type TextSize,
  parseReadabilityPrefs,
  textSizeScale,
} from "@/lib/readability";

type ReadabilityState = {
  textSize: TextSize;
  setTextSize: (textSize: TextSize) => void;
};

export const useReadability = create<ReadabilityState>()(
  persist(
    (set) => ({
      textSize: DEFAULT_TEXT_SIZE,
      setTextSize: (textSize) => set({ textSize }),
    }),
    {
      name: READABILITY_STORAGE_KEY,
      version: READABILITY_STORAGE_VERSION,
      partialize: ({ textSize }) => ({ textSize }),
      migrate: parseReadabilityPrefs,
      merge: (persisted, current) => ({ ...current, ...parseReadabilityPrefs(persisted) }),
    },
  ),
);

export const useReadabilitySync = () => {
  const textSize = useReadability((state) => state.textSize);
  useLayoutEffect(() => {
    if (textSize === DEFAULT_TEXT_SIZE) return;
    const root = document.documentElement;
    root.dataset.textSize = textSize;
    root.style.setProperty("--content-text-scale", String(textSizeScale(textSize)));
    return () => {
      delete root.dataset.textSize;
      root.style.removeProperty("--content-text-scale");
    };
  }, [textSize]);
};
