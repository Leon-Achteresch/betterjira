import { useState } from "react";
import {
  selectedIssues,
  toggleIssueSelection,
  toggleLoadedSelection,
} from "@/lib/issue-selection";

export function useIssueSelection<T extends { key: string }>(
  scope: string,
  issues: readonly T[],
) {
  const [selection, setSelection] = useState({ scope, keys: [] as string[] });
  if (selection.scope !== scope) setSelection({ scope, keys: [] });
  const keys = selection.scope === scope ? selection.keys : [];
  const selected = selectedIssues(issues, keys);

  return {
    selected,
    selectedKeys: new Set(selected.map((issue) => issue.key)),
    allSelected: issues.length > 0 && selected.length === issues.length,
    toggle: (key: string) =>
      setSelection({ scope, keys: toggleIssueSelection(keys, key) }),
    toggleAll: () =>
      setSelection({
        scope,
        keys: toggleLoadedSelection(
          keys,
          issues.map((issue) => issue.key),
        ),
      }),
    clear: () => setSelection({ scope, keys: [] }),
  };
}
