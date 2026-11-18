const DE = {
  title: "Statusaufenthalte", choose: "Status bewusst auswählen", placeholder: "Status auswählen…",
  explanation: "Wähle selbst den Status, den du als Wartephase betrachten möchtest. Statusnamen werden nicht automatisch gedeutet.",
  closed: "Bestätigte abgeschlossene Aufenthalte", running: "Laufend bis zum Berechnungsstand (separat)",
  empty: "Keine bestätigten abgeschlossenen Aufenthalte in den geladenen Daten.", noStatus: "Keine Statusidentität in den geladenen Daten verfügbar.",
  full: "Gelieferte Historie vollständig und konsistent rekonstruierbar.", partial: "Teilansicht – keine vollständige Gesamtzeit.",
  calendar: "Kalenderdauer · keine Arbeitszeit, SLA- oder Sprintmetrik. Kein Echtzeitwert.", asOf: "Berechnungsstand", coverage: "Geladene Änderungen", limit: "Obergrenze", failed: "Historienabruf fehlgeschlagen – zuletzt geladener Stand.",
  invalid: "Ungültige Zeitpunkte oder Lücken in den gelieferten Daten: keine bestätigte Summe berechenbar.",
  simultaneous: "Gleichzeitige Statuswechsel ohne sichere Reihenfolge wurden nicht als Aufenthalte gerechnet.",
  chain: "Widersprüchliche Übergänge: betroffene Grenzen bleiben unbekannt.",
  identity: "Fehlende Status-IDs: gleichnamige Status werden nicht gleichgesetzt; diese Grenzen sind unbestätigt.",
  current: "Letzter Übergang und aktueller Status stimmen nicht überein. Kein laufender Aufenthalt abgeleitet.",
  renamed: "Weitere beobachtete Namen derselben ID", unknown: "Unbekannter Status", noId: "ohne ID",
  cut: "Grenze unbekannt · nicht summiert", open: "laufend · separat", confirmed: "abgeschlossen", creation: "ab Erstellung", unknownStart: "Beginn unbekannt", unknownEnd: "Ende unbekannt",
  showMore: "Alle Aufenthalte zeigen", showLess: "Weniger zeigen", unselected: "Erst nach deiner Auswahl wird die Dauer für diesen Status angezeigt.",
  stays: "Aufenthalte", notSummed: "nicht summiert",
};
const EN: typeof DE = {
  title: "Time in status", choose: "Explicitly select a status", placeholder: "Select a status…",
  explanation: "Choose the status you want to treat as a waiting phase. Status names are not interpreted automatically.",
  closed: "Confirmed completed stays", running: "Ongoing up to the snapshot (separate)",
  empty: "No confirmed completed stays in the loaded data.", noStatus: "No status identity available in the loaded data.",
  full: "Returned history can be reconstructed completely and consistently.", partial: "Partial view – not a complete lifetime total.",
  calendar: "Calendar duration · not working time, an SLA or a sprint metric. Not a live value.", asOf: "As of", coverage: "Loaded changes", limit: "Limit", failed: "History request failed – showing the last loaded snapshot.",
  invalid: "Invalid timestamps or gaps in the returned data: a confirmed sum cannot be calculated.",
  simultaneous: "Simultaneous status changes without a reliable order were excluded from stays.",
  chain: "Inconsistent transitions: affected boundaries remain unknown.",
  identity: "Missing status IDs: matching names are not treated as matching identities; these boundaries are unconfirmed.",
  current: "The last transition and current status disagree. No ongoing stay was inferred.",
  renamed: "Other observed names for this ID", unknown: "Unknown status", noId: "no ID",
  cut: "Unknown boundary · excluded from sum", open: "ongoing · separate", confirmed: "completed", creation: "since creation", unknownStart: "Unknown start", unknownEnd: "Unknown end",
  showMore: "Show all stays", showLess: "Show fewer", unselected: "Select a status to see its duration.",
  stays: "Stays", notSummed: "not summed",
};

export const statusIntervalTranslator = (locale: string) => {
  const messages = locale.startsWith("en") ? EN : DE;
  return (key: keyof typeof DE) => messages[key];
};

export const statusIntervalDuration = (milliseconds: number, locale: string) => {
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const number = new Intl.NumberFormat(locale);
  return [days ? `${number.format(days)} ${locale.startsWith("en") ? "d" : "T"}` : "", hours ? `${hours} h` : "", minutes ? `${minutes} min` : "", seconds % 60 || seconds === 0 ? `${seconds % 60} s` : ""].filter(Boolean).join(" ");
};
