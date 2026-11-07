import { Schema } from "effect";
import { addTab, removeTab } from "./issue-tabs";

export const IssueTabSet = Schema.Struct({
  keys: Schema.Array(Schema.String),
  pinned: Schema.Array(Schema.String),
});

export type IssueTabSet = typeof IssueTabSet.Type;

export const StoredIssueTabs = Schema.Struct({
  workspaces: Schema.Record(Schema.String, IssueTabSet),
  legacy: Schema.optional(IssueTabSet),
});

export type StoredIssueTabs = typeof StoredIssueTabs.Type;

export const EMPTY_TAB_SET: IssueTabSet = { keys: [], pinned: [] };
export const EMPTY_STORED_TABS: StoredIssueTabs = { workspaces: {} };

const isTabSet = Schema.is(IssueTabSet);
const isScopedShape = Schema.is(
  Schema.Struct({
    workspaces: Schema.Record(Schema.String, Schema.Unknown),
    legacy: Schema.optional(Schema.Unknown),
  }),
);

export const normalizeTabSet = ({ keys, pinned }: IssueTabSet): IssueTabSet => {
  const unique = [...new Set(keys)];
  return { keys: unique, pinned: [...new Set(pinned)].filter((key) => unique.includes(key)) };
};

const quarantine = (value: unknown): Pick<StoredIssueTabs, "legacy"> => {
  if (!isTabSet(value)) return {};
  const tabs = normalizeTabSet(value);
  return tabs.keys.length > 0 ? { legacy: tabs } : {};
};

export const parseStoredIssueTabs = (value: unknown): StoredIssueTabs => {
  if (isScopedShape(value)) {
    const workspaces = Object.entries(value.workspaces).flatMap(([id, tabs]) =>
      isTabSet(tabs) ? [[id, normalizeTabSet(tabs)] as const] : [],
    );
    return { workspaces: Object.fromEntries(workspaces), ...quarantine(value.legacy) };
  }
  return { ...EMPTY_STORED_TABS, ...quarantine(value) };
};

export const tabsOf = (stored: StoredIssueTabs, scope: string | undefined): IssueTabSet =>
  (scope ? stored.workspaces[scope] : undefined) ?? EMPTY_TAB_SET;

export const updateScopeTabs = (
  stored: StoredIssueTabs,
  scope: string,
  transform: (tabs: IssueTabSet) => IssueTabSet,
): StoredIssueTabs => ({
  ...stored,
  workspaces: { ...stored.workspaces, [scope]: transform(tabsOf(stored, scope)) },
});

export const withTab = (tabs: IssueTabSet, key: string): IssueTabSet => {
  const keys = addTab(tabs.keys, key);
  return keys === tabs.keys ? tabs : { ...tabs, keys };
};

export const withoutTab = (tabs: IssueTabSet, key: string): IssueTabSet => ({
  keys: removeTab(tabs.keys, key),
  pinned: removeTab(tabs.pinned, key),
});

export const withPinToggled = (tabs: IssueTabSet, key: string): IssueTabSet => ({
  ...tabs,
  pinned: tabs.pinned.includes(key) ? removeTab(tabs.pinned, key) : [...tabs.pinned, key],
});

export const withKeys = (tabs: IssueTabSet, keys: readonly string[]): IssueTabSet => ({ ...tabs, keys });

const union = (first: readonly string[], second: readonly string[]) => [
  ...first,
  ...second.filter((key) => !first.includes(key)),
];

export const mergeTabSets = (first: IssueTabSet, second: IssueTabSet): IssueTabSet => ({
  keys: union(first.keys, second.keys),
  pinned: union(first.pinned, second.pinned),
});

export const adoptLegacyTabs = (stored: StoredIssueTabs, scope: string): StoredIssueTabs => {
  const { legacy } = stored;
  if (!legacy) return stored;
  return { ...updateScopeTabs(stored, scope, (tabs) => mergeTabSets(legacy, tabs)), legacy: undefined };
};

export const undoLegacyAdoption = (
  stored: StoredIssueTabs,
  scope: string,
  before: IssueTabSet,
  legacy: IssueTabSet,
): StoredIssueTabs => {
  const addedKeys = legacy.keys.filter((key) => !before.keys.includes(key));
  const addedPins = legacy.pinned.filter((key) => !before.pinned.includes(key));
  const restored = updateScopeTabs(stored, scope, (tabs) => {
    const keys = tabs.keys.filter((key) => !addedKeys.includes(key));
    return { keys, pinned: tabs.pinned.filter((key) => !addedPins.includes(key) && keys.includes(key)) };
  });
  return restoreLegacyTabs(restored, legacy);
};

export const discardLegacyTabs = (stored: StoredIssueTabs): StoredIssueTabs => ({ ...stored, legacy: undefined });

export const restoreLegacyTabs = (stored: StoredIssueTabs, legacy: IssueTabSet): StoredIssueTabs => ({
  ...stored,
  legacy: stored.legacy ? mergeTabSets(stored.legacy, legacy) : legacy,
});

export const legacyTabsLabel = (count: number) => `${count} ${count === 1 ? "früherer Tab" : "frühere Tabs"}`;
