import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import { readBoardDisplay } from "@/lib/view-preferences";
import { type CardProperty, DEFAULT_HIDDEN_PROPERTIES } from "@/lib/board-display";
import { type InsightDimension, type InsightMeasure, type InsightSegment } from "@/lib/board-insights";

type BoardDisplayState = {
  insightsOpen: boolean;
  measure: InsightMeasure;
  slice: InsightDimension;
  segment: InsightSegment;
  hiddenProperties: CardProperty[];
  toggleInsights: () => void;
  closeInsights: () => void;
  setMeasure: (measure: InsightMeasure) => void;
  setSlice: (slice: InsightDimension) => void;
  setSegment: (segment: InsightSegment) => void;
  toggleProperty: (property: CardProperty) => void;
  resetProperties: () => void;
};

export const useBoardDisplay = create<BoardDisplayState>()(
  persist(
    (set) => ({
      insightsOpen: false,
      measure: "count",
      slice: "status",
      segment: "priority",
      hiddenProperties: DEFAULT_HIDDEN_PROPERTIES,
      toggleInsights: () => set(({ insightsOpen }) => ({ insightsOpen: !insightsOpen })),
      closeInsights: () => set({ insightsOpen: false }),
      setMeasure: (measure) => set({ measure }),
      setSlice: (slice) => set(({ segment }) => ({ slice, segment: segment === slice ? "none" : segment })),
      setSegment: (segment) => set({ segment }),
      toggleProperty: (property) =>
        set(({ hiddenProperties }) => ({
          hiddenProperties: hiddenProperties.includes(property)
            ? hiddenProperties.filter((hidden) => hidden !== property)
            : [...hiddenProperties, property],
        })),
      resetProperties: () => set({ hiddenProperties: DEFAULT_HIDDEN_PROPERTIES }),
    }),
    {
      name: "betterjira-board-display",
      version: 1,
      storage: createJSONStorage(() => LOCAL_PREFERENCE_STORAGE),
      partialize: ({ insightsOpen, measure, slice, segment, hiddenProperties }) => ({ insightsOpen, measure, slice, segment, hiddenProperties }),
      migrate: (persisted) => readBoardDisplay(persisted),
      merge: (persisted, current) => ({ ...current, ...readBoardDisplay(persisted) }),
    },
  ),
);
