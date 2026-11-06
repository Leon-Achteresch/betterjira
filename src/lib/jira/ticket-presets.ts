export const TICKET_PRESETS = {
  offen: {
    label: "Meine offenen",
    description: "Dir zugewiesen und noch nicht erledigt.",
    jql: "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
  },
  beobachtet: {
    label: "Beobachtet",
    description: "Tickets, die du beobachtest.",
    jql: "watcher = currentUser() ORDER BY updated DESC",
  },
  alle: {
    label: "Alle meine",
    description: "Dir zugewiesen, von dir erstellt oder beobachtet.",
    jql: "(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) ORDER BY updated DESC",
  },
} as const;

export type TicketPreset = keyof typeof TICKET_PRESETS;

export const TICKET_PRESET_IDS = Object.keys(TICKET_PRESETS) as TicketPreset[];

export const DEFAULT_TICKET_PRESET: TicketPreset = "offen";

export const ticketPresetOf = (value: unknown): TicketPreset =>
  TICKET_PRESET_IDS.find((id) => id === value) ?? DEFAULT_TICKET_PRESET;

export const ticketPresetSearch = (preset: TicketPreset): { ansicht?: TicketPreset } =>
  preset === DEFAULT_TICKET_PRESET ? {} : { ansicht: preset };
