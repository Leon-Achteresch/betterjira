import type { Rollout } from "@/lib/calendar/model";

export type RolloutFormTarget = { rollout: Rollout } | { template: Rollout } | { day: Date };

export type RolloutActions = {
  onEdit: (rollout: Rollout) => void;
  onDuplicate: (rollout: Rollout) => void;
  onDelete: (rollout: Rollout) => void;
  onSync: (rollout: Rollout) => void;
  onOpenOutlook: (eventId: string) => void;
  onOpenIssue: (rollout: Rollout, key: string) => void;
};
