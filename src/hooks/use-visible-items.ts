import { useState } from "react";

export function useVisibleItems<T>(items: readonly T[], limit: number) {
  const [expanded, setExpanded] = useState(false);
  return {
    visible: expanded ? items : items.slice(0, limit),
    expanded,
    canExpand: items.length > limit,
    toggle: () => setExpanded((current) => !current),
  };
}
