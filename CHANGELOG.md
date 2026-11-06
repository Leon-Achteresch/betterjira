# Änderungen

## 0.3.0 – 2026-11-06

### Neu

- Dark Mode: Über das neue Symbol oben rechts im Header wechselst du zwischen System, Hell und Dunkel. Die Auswahl bleibt nach einem Neustart erhalten.

## 0.2.1 – 2026-11-06

### Fehlerbehebung

- Die Anmeldung im installierten Build scheitert nicht mehr mit „Schlüsselbund konnte nicht beschrieben werden“. Anmeldedaten und Code-Hosting-Tokens liegen jetzt in einer nur für dich lesbaren Datei im App-Datenordner statt im macOS-Schlüsselbund, so bleiben sie auch nach Updates erhalten.
- Nach dem Update einmal neu bei Jira anmelden und Code-Hosting-Tokens erneut hinterlegen.

## 0.2.0 – 2026-11-04

### Im Arbeitsalltag weiterkommen

- „Weiterarbeiten“ bündelt bis zu 50 letzte Ticketkontexte, angeheftete Tickets, private Notizen und offene Entwürfe.
- Ticketbezogene Lesestellen werden beim Wechsel gespeichert und beim Zurückkehren wiederhergestellt.
- Text- und Beschreibungsentwürfe bleiben bei Unterbrechungen erhalten; revisionsbezogenes Speichern schützt neuere Eingaben.
- Kommentare erhalten lokale Entwürfe, Vorlagen, Rückgängig und eine gespeicherte Sortierreihenfolge.
- Mehrfachauswahl ermöglicht gezielten Export als Schlüsselliste, Tabelle oder Markdown.
- Zeiterfassung bietet Dauer-Kürzel, „Beginn jetzt“ und validierte Eingaben.

### Eine ruhigere Oberfläche

- Der Ticketkopf konzentriert sich auf Details, Anheften und ein Menü für weitere Aktionen.
- Entwicklung, Anhänge, Zeiterfassung, Notizen und Zusatzfelder liegen im Drawer.
- Kommentarwerkzeuge erscheinen bei Bedarf; zusätzliche Schnellfilter sind in einem Menü gebündelt.
- Die Startseite bietet einen direkten Wiedereinstieg und begrenzt lange Arbeitslisten.
- Statuswechsel erhalten animierte Symbole und Übergänge. Drawer nutzen schmale Fenster vollständig und beachten Reduced Motion.
- Tastaturfokus kehrt nach dem Schließen zur auslösenden Aktion zurück.

### KI-Briefing

- Drei kompakte Vorschläge als Einstieg; Begründungen und Analyseumfang im Detail-Drawer.
- Klare Zustände für Laden, laufende Analyse, Fehler, ausstehende Antwort und fertiges Ergebnis.
- Schutz gegen doppelte Starts; ein bereiter Rückkanal ist Voraussetzung für die Analyse.
- Ergebnisse werden auch während der Ticketarbeit empfangen und nur dem zugeordneten Konto angezeigt.

### Veröffentlichung

- Installer für macOS (Apple Silicon und Intel), Windows und Linux.
- Signierte Update-Artefakte und `latest.json` für den integrierten Updater.
- Veröffentlichung erst nach erfolgreichen Plattform-Builds und erstelltem Update-Manifest.

### Prüfung

103 automatische Tests, TypeScript und Produktionsbuild erfolgreich. Die UI wurde mit lokalen Jira-/KI-Testdaten einschließlich 35 Arbeitskontexten, Unterbrechungen, Fehlerfällen, schmaler Darstellung und Reduced Motion geprüft.

Lokale Kontexte werden nicht zwischen Geräten synchronisiert. Reale Jira-Berechtigungen und die Qualität echter KI-Ergebnisse sind nicht Bestandteil der simulierten Browserprüfung.
