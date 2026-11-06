export const addTab = (keys: string[], key: string) => (keys.includes(key) ? keys : [...keys, key]);

export const removeTab = (keys: string[], key: string) => keys.filter((existing) => existing !== key);

export const orderTabs = (keys: string[], pinned: string[]) => [
  ...keys.filter((key) => pinned.includes(key)),
  ...keys.filter((key) => !pinned.includes(key)),
];

export const neighborTab = (keys: string[], key: string) => {
  const index = keys.indexOf(key);
  return keys[index + 1] ?? keys[index - 1];
};

export const keepOthers = (keys: string[], pinned: string[], key: string) =>
  keys.filter((existing) => existing === key || pinned.includes(existing));

export const keepUntil = (keys: string[], pinned: string[], key: string) => {
  const ordered = orderTabs(keys, pinned);
  const kept = ordered.slice(0, ordered.indexOf(key) + 1);
  return keys.filter((existing) => kept.includes(existing) || pinned.includes(existing));
};

export const issueKeyFromHref = (href: string | null | undefined) => {
  const match = href?.match(/^\/issue\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
};
