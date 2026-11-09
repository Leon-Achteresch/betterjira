type SearchableShortcut = { label: string; keys: string[][] };
type SearchableGroup<S extends SearchableShortcut> = { group: string; shortcuts: S[] };

const KEY_ALIASES: Record<string, string[]> = {
  Ctrl: ["strg", "control"],
  "⌃": ["control", "ctrl", "strg"],
  "⌘": ["cmd", "command", "befehl"],
  "⌥": ["option", "opt", "alt"],
  Alt: ["option"],
  Shift: ["umschalt"],
  "⇧": ["shift", "umschalt"],
  Tab: ["tabulator"],
  "⇥": ["tab", "tabulator"],
  "↵": ["enter", "eingabe", "return"],
  "←": ["pfeil", "links", "arrowleft"],
  "→": ["pfeil", "rechts", "arrowright"],
  ",": ["komma", "comma"],
  "?": ["fragezeichen"],
  "1–9": ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
};

const normalize = (value: string) => value.toLocaleLowerCase("de");

const queryTerms = (query: string) => normalize(query).split(/[\s+]+/).filter(Boolean);

const words = (value: string) => normalize(value).split(/[\s\-/]+/).filter(Boolean);

const shortcutIndex = (shortcut: SearchableShortcut, group: string) => {
  const keys = shortcut.keys.flatMap((step) => step.flatMap((key) => [normalize(key), ...(KEY_ALIASES[key] ?? [])]));
  const texts = [normalize(shortcut.label), normalize(group), ...shortcut.keys.map((step) => normalize(step.join(""))), ...keys];
  return { keys, texts, words: [...words(shortcut.label), ...words(group)] };
};

const matchesTerm = (term: string, index: ReturnType<typeof shortcutIndex>) =>
  term.length === 1
    ? index.keys.includes(term) || index.words.some((word) => word.startsWith(term))
    : index.texts.some((text) => text.includes(term));

export const filterShortcutGroups = <S extends SearchableShortcut, G extends SearchableGroup<S>>(
  groups: readonly G[],
  query: string,
): G[] => {
  const terms = queryTerms(query);
  if (terms.length === 0) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) => {
        const index = shortcutIndex(shortcut, group.group);
        return terms.every((term) => matchesTerm(term, index));
      }),
    }))
    .filter((group) => group.shortcuts.length > 0);
};

export const countShortcuts = (groups: readonly SearchableGroup<SearchableShortcut>[]) =>
  groups.reduce((sum, group) => sum + group.shortcuts.length, 0);
