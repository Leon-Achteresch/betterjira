# Dauerhafter Arbeitsplatz

Die Oberfläche merkt sich im versionierten Zustand-Store `betterjira-interface` die Desktop-Seitenleiste sowie je bestätigtem Jira-Konto aufgeklappte Gruppen, Projekte und Tabellensuchtexte. Mobile Navigations-Overlays starten geschlossen. Angeheftete Tickets, Kommentar-/Feldentwürfe, Notizen und Lesestellen nutzen weiterhin ihre bestehenden kontobezogenen Speicher.

Tabellenansichten, Schnellfilter, Facetten, Sortierung, Zeilendichte und Boardfilter werden getrennt nach Jira-Instanz und Konto gespeichert. Neue Suchtexte eines Kontos gelangen auch während des Debounce-Intervalls nicht in die Abfragen eines anderen Kontos. Der Speicher enthält UI-Auswahl, keine Zugangsdaten oder zusätzlich persistierte Jira-Antworten.

Effect-Schemas prüfen die Hydration und Migration. Defekte Einträge fallen auf gültige Defaults zurück, gespeicherte Daten können keine Store-Aktionen ersetzen. Identische Schreibvorgänge werden unterdrückt; Suchtexte und gespeicherte Gruppeneinträge sind begrenzt. Bei gesperrtem oder vollem Local Storage bleibt die aktuelle Sitzung bedienbar; diese Änderungen können dann einen Neustart nicht überleben.

Vorherige globale Spaltenauswahl und Zeilendichte bleiben als Darstellungsvorgabe erhalten. Fachliche Filter und benannte Ansichten ohne bekanntes Besitzerkonto bleiben in den bisherigen Schlüsseln gespeichert, werden aber keinem beliebigen angemeldeten Konto automatisch zugeordnet. „Zurücksetzen“ schreibt die echten Defaults.

## Projektmuster

L8DB (`src/lib/connections/store.ts`, `src/lib/table-tabs/store.ts`) liefert das Vorbild für getrennte Verbindungskontexte, gezieltes Speichern, kontrollierte Wiederherstellung und Fehlerrobustheit. L8Git (`src/lib/github-expansion/store.ts`, `src/lib/repo-store.ts`) liefert das Vorbild für dauerhafte UI-Auswahl und getrennte Ausklappzustände. Die Umsetzung hier verwendet die vorhandenen Betterjira-Schemas, Hooks und Kontoidentitäten.

## Glas und Plattformen

macOS verwendet natives Liquid Glass und fällt auf älteren Systemen auf das Sidebar-Material zurück. Windows verwendet Mica nur nach erfolgreicher nativer Einrichtung; ältere oder nicht unterstützte Systeme behalten den lesbaren, deckenden Hintergrund. Linux und der Browser verwenden die CSS-Glasflächen. Reduzierte Transparenz schaltet auf deckende Flächen, reduzierte Bewegung auf kurze Fades beziehungsweise keine Bewegung.
