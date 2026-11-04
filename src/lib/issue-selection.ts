export const selectedIssues = <T extends { key: string }>(
  issues: readonly T[],
  keys: readonly string[],
) => {
  const selected = new Set(keys);
  return issues.filter((issue) => selected.has(issue.key));
};

export const toggleIssueSelection = (keys: readonly string[], key: string) =>
  keys.includes(key)
    ? keys.filter((selected) => selected !== key)
    : [...keys, key];

export const toggleLoadedSelection = (
  keys: readonly string[],
  loadedKeys: readonly string[],
) => {
  const selected = new Set(keys);
  const allSelected =
    loadedKeys.length > 0 && loadedKeys.every((key) => selected.has(key));
  const loaded = new Set(loadedKeys);
  return allSelected
    ? keys.filter((key) => !loaded.has(key))
    : [...new Set([...keys, ...loadedKeys])];
};
