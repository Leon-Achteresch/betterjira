import { Schema } from "effect";

const ProjectIds = Schema.Array(Schema.String);

export const ProjectPrefs = Schema.Struct({ favoriteIds: ProjectIds, hiddenIds: ProjectIds });
export type ProjectPrefs = typeof ProjectPrefs.Type;
export type ProjectPrefList = keyof ProjectPrefs;

export const ProjectPrefsStore = Schema.Struct({
  scopes: Schema.Record(Schema.String, ProjectPrefs),
  legacy: Schema.NullOr(ProjectPrefs),
});
export type ProjectPrefsStore = typeof ProjectPrefsStore.Type;

export const EMPTY_PROJECT_PREFS: ProjectPrefs = { favoriteIds: [], hiddenIds: [] };
export const EMPTY_PROJECT_PREFS_STORE: ProjectPrefsStore = { scopes: {}, legacy: null };

const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const isUnknownArray = Schema.is(Schema.Array(Schema.Unknown));

const readIds = (value: unknown) => (isUnknownArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : []);

const readPrefs = (value: unknown): ProjectPrefs =>
  isRecord(value) ? { favoriteIds: readIds(value.favoriteIds), hiddenIds: readIds(value.hiddenIds) } : EMPTY_PROJECT_PREFS;

const isEmpty = (prefs: ProjectPrefs) => prefs.favoriteIds.length === 0 && prefs.hiddenIds.length === 0;

const mergePrefs = (a: ProjectPrefs, b: ProjectPrefs): ProjectPrefs => ({
  favoriteIds: [...new Set([...a.favoriteIds, ...b.favoriteIds])],
  hiddenIds: [...new Set([...a.hiddenIds, ...b.hiddenIds])],
});

export const readProjectPrefsStore = (persisted: unknown): ProjectPrefsStore => {
  if (!isRecord(persisted)) return EMPTY_PROJECT_PREFS_STORE;
  const scopes = isRecord(persisted.scopes)
    ? Object.fromEntries(Object.entries(persisted.scopes).map(([scope, prefs]) => [scope, readPrefs(prefs)]))
    : {};
  const legacy = mergePrefs(readPrefs(persisted.legacy), {
    favoriteIds: readIds(persisted.projectIds),
    hiddenIds: readIds(persisted.hiddenProjectIds),
  });
  return { scopes, legacy: isEmpty(legacy) ? null : legacy };
};

export const scopedProjectPrefs = (store: ProjectPrefsStore, scope: string | null) =>
  scope === null ? EMPTY_PROJECT_PREFS : (store.scopes[scope] ?? EMPTY_PROJECT_PREFS);

const toggleId = (ids: readonly string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export const toggleProjectPref = (
  store: ProjectPrefsStore,
  scope: string,
  list: ProjectPrefList,
  id: string,
): ProjectPrefsStore => {
  const prefs = scopedProjectPrefs(store, scope);
  return { ...store, scopes: { ...store.scopes, [scope]: { ...prefs, [list]: toggleId(prefs[list], id) } } };
};

export const adoptLegacyProjectPrefs = (store: ProjectPrefsStore, scope: string): ProjectPrefsStore =>
  store.legacy === null
    ? store
    : {
        scopes: { ...store.scopes, [scope]: mergePrefs(scopedProjectPrefs(store, scope), store.legacy) },
        legacy: null,
      };
