import { formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys";
import { IS_MAC } from "@/lib/platform";

export type ShortcutId =
  | "palette"
  | "help"
  | "createIssue"
  | "sidebar"
  | "back"
  | "forward"
  | "home"
  | "tickets"
  | "search"
  | "settings"
  | "nextTab"
  | "prevTab"
  | "tabByIndex"
  | "closeTab"
  | "nextRow"
  | "prevRow"
  | "openRow";

export type Shortcut = {
  id: ShortcutId;
  hotkey: Hotkey;
  label: string;
  group: string;
  keys: string[][];
};

const displayKeys = (hotkey: Hotkey): string[][] =>
  typeof hotkey === "string"
    ? [formatForDisplay(hotkey, { parts: true })]
    : hotkey.map((step) => formatForDisplay(step, { parts: true }));

const shortcut = (id: ShortcutId, hotkey: Hotkey, label: string, group: string, keys = displayKeys(hotkey)): Shortcut => ({
  id,
  hotkey,
  label,
  group,
  keys,
});

export const SHORTCUTS: Shortcut[] = [
  shortcut("palette", "Mod+K", "Suchen und Befehle", "Allgemein"),
  shortcut("help", "?", "Tastenkürzel anzeigen", "Allgemein"),
  shortcut("sidebar", "Mod+B", "Seitenleiste ein-/ausblenden", "Allgemein"),
  shortcut("createIssue", "C", "Ticket erstellen", "Allgemein"),
  shortcut("back", IS_MAC ? "Mod+[" : "Alt+ArrowLeft", "Zurück", "Navigation"),
  shortcut("forward", IS_MAC ? "Mod+]" : "Alt+ArrowRight", "Vor", "Navigation"),
  shortcut("home", ["G", "H"], "Übersicht", "Navigation"),
  shortcut("tickets", ["G", "T"], "Jira-Tickets", "Navigation"),
  shortcut("search", ["G", "S"], "Ticketsuche", "Navigation"),
  shortcut("settings", "Mod+,", "Einstellungen", "Navigation"),
  shortcut("nextTab", "Control+Tab", "Nächster Ticket-Tab", "Ticket-Tabs"),
  shortcut("prevTab", "Control+Shift+Tab", "Vorheriger Ticket-Tab", "Ticket-Tabs"),
  shortcut("tabByIndex", "Mod+1", "Ticket-Tab 1 bis 9", "Ticket-Tabs", [
    [...formatForDisplay("Mod+1", { parts: true }).slice(0, -1), "1–9"],
  ]),
  shortcut("closeTab", "Mod+W", "Ticket-Tab schließen", "Ticket-Tabs"),
  shortcut("nextRow", "J", "Nächster Eintrag", "Listen"),
  shortcut("prevRow", "K", "Vorheriger Eintrag", "Listen"),
  shortcut("openRow", "Enter", "Eintrag öffnen", "Listen"),
];

export const shortcutHotkey = (id: ShortcutId) => SHORTCUTS.find((entry) => entry.id === id)!.hotkey;

export const shortcutHint = (id: ShortcutId) =>
  (SHORTCUTS.find((entry) => entry.id === id)?.keys ?? [])
    .map((step) => step.join(IS_MAC ? "" : "+"))
    .join(" ");

export const SHORTCUT_GROUPS = [...new Set(SHORTCUTS.map((entry) => entry.group))].map((group) => ({
  group,
  shortcuts: SHORTCUTS.filter((entry) => entry.group === group),
}));
