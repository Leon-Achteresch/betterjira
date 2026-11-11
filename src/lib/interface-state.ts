import { Schema } from "effect";

const BooleanMap = Schema.Record(Schema.String, Schema.Boolean);
const StringMap = Schema.Record(Schema.String, Schema.String);
const InterfaceAccount = Schema.Struct({ sections: BooleanMap, projects: BooleanMap, tableSearches: StringMap });
export type InterfaceAccount = typeof InterfaceAccount.Type;

export const InterfacePreferences = Schema.Struct({
  sidebarOpen: Schema.Boolean,
  accounts: Schema.Record(Schema.String, InterfaceAccount),
});
export type InterfacePreferences = typeof InterfacePreferences.Type;

export const EMPTY_INTERFACE_ACCOUNT: InterfaceAccount = { sections: {}, projects: {}, tableSearches: {} };
export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = { sidebarOpen: true, accounts: {} };
export const INTERFACE_STORAGE_KEY = "betterjira-interface";

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const isBooleanMap = Schema.is(BooleanMap);
const isStringMap = Schema.is(StringMap);

const boundedEntries = <T>(values: Record<string, T>, limit: number) => Object.fromEntries(Object.entries(values).slice(-limit));
const booleans = (value: unknown) => isBooleanMap(value) ? boundedEntries(value, 200) : {};
const strings = (value: unknown) => isStringMap(value)
  ? boundedEntries(Object.fromEntries(Object.entries(value).map(([key, text]) => [key, text.slice(0, 1000)])), 50)
  : {};

export const readInterfacePreferences = (persisted: unknown): InterfacePreferences => {
  if (!isRecord(persisted)) return DEFAULT_INTERFACE_PREFERENCES;
  const accounts = isRecord(persisted.accounts)
    ? Object.fromEntries(Object.entries(persisted.accounts).flatMap(([scope, value]) => isRecord(value)
      ? [[scope, { sections: booleans(value.sections), projects: booleans(value.projects), tableSearches: strings(value.tableSearches) }]]
      : []))
    : {};
  return { sidebarOpen: typeof persisted.sidebarOpen === "boolean" ? persisted.sidebarOpen : true, accounts };
};

export const interfaceAccount = (preferences: InterfacePreferences, scope: string | null) =>
  scope === null ? EMPTY_INTERFACE_ACCOUNT : preferences.accounts[scope] ?? EMPTY_INTERFACE_ACCOUNT;

export function updateInterfaceAccount<K extends keyof InterfaceAccount>(
  preferences: InterfacePreferences,
  scope: string | null,
  key: K,
  update: (current: InterfaceAccount[K]) => InterfaceAccount[K],
): InterfacePreferences {
  if (scope === null) return preferences;
  const account = interfaceAccount(preferences, scope);
  return { ...preferences, accounts: { ...preferences.accounts, [scope]: { ...account, [key]: update(account[key]) } } };
}

export const preferenceScope = (account: string, view: string) => JSON.stringify([account, view]);
