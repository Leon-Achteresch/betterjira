# Änderungen

## 0.11.0 – 2026-11-11

### Neu

- dateien erst beim absenden hochladen
- datei-drops neben dem editor abfangen
- dateien per drop in den editor einfügen
- beschreibung im editor bearbeiten
- bilder im editor einbetten und einfügen
- anhänge direkt im ticket anzeigen
- bilder in beschreibung und kommentaren
- anhänge über provider bereitstellen
- gerenderte fassung je ticket laden
- gerenderte fassung abfragen
- media-knoten anhängen zuordnen
- benachrichtigung springt zum kommentar
- jira-links in der app öffnen
- zum kommentar springen
- kommentare nach bestätigung löschen
- kommentare an ort und stelle bearbeiten
- aktionsmenü an kommentaren
- datenbasis für kommentaraktionen
- auf kommentare antworten
- kommentar-sektion mit threads neu aufbauen
- personen per @ im kommentar erwähnen
- kommentarentwürfe als adf speichern
- adf-editor von außen steuerbar machen
- mentions im adf-editor verlustfrei abbilden
- kommentare seitenweise laden und antworten
- kommentar-threads und mention-ranking

### Fehlerbehebung

- anhang-kacheln aus dem cache einblenden
- fremde kommentare nach abruf einordnen
- ablagefläche für datei-drops freigeben
- unlesbaren beschreibungsentwurf nicht senden
- kopierten text nicht als bild einfügen
- sprungziel bei nachladenden bildern halten
- anhangsbilder mit accept */* laden
- sprung, menüknopf und entwurfsbereinigung
- bild-hinweise nachladen und nicht springen
- review-befunde zum merge beheben
- kommentar beim antworten nicht strecken
- entwurf, strg-klick und spinner nachbessern
- review-befunde zu antworten und mentions

## 0.10.0 – 2026-11-09

### Neu

- Integration mit Profilbildern und gemeinsamen Ticket-Tabs ergänzen
- Liquid-Glass-Abstufungen und durchgängige Motion-Animationen übernehmen
- Heute-Seite mit „Heute zu tun“, gruppierte Navigation mit Zähler für Ungelesenes

### Fehlerbehebung

- Profilvorschauen aus der Personenauswahl heraushalten
- ausgeblendete Listeneinträge sofort aus der Tab-Reihenfolge nehmen
- Navigation und vollständige Browserprüfung korrigieren
- Zammad und Motion in der Release-Fixture prüfen
- Review-Findings zu Agenda und Benachrichtigungen
- Fokus nach dem Schließen der Notiz nutzt die aktuelle Liste
- schneller zustellen, pro Abfrage nur ein Hinweis, Ruhezeit pro Ticket

## 0.9.2 – 2026-11-09

### Fehlerbehebung

- unnötige Tab-Retries vermeiden und Browserprüfungen stabilisieren
- Mock-Änderungen atomar prüfen und abgeglichene Boards frisch halten
- Boards früher anzeigen und Änderungen gezielt abgleichen

## 0.9.1 – 2026-11-09

### Fehlerbehebung

- alle Statusspalten über Jira-Folgeseiten laden

## 0.9.0 – 2026-11-08

### Neu

- persönliche Notizen direkt in der Übersicht bearbeiten
- Bereichsübersicht sortierbar
- Ticket-Tabs je Jira-Konto und Instanz speichern
- Ticketansicht nach Lade- und Aktualisierungsfehlern wiederherstellen
- Jira-Link zu einzelnem Kommentar kopieren
- weitere Kommentare seitenweise nachladen
- bereits geladene Anhaenge lokal sortieren
- check activity on demand
- open Jira ticket links from the command palette
- geöffnete Ticket-Tabs durchsuchen und wechseln
- Jira-Aktivitätshinweise in App und System getrennt steuern
- Projektfavoriten und ausgeblendete Bereiche je Jira-Konto speichern
- Unteraufgaben-Übersicht mit Filter Alle/Offen
- lokale Suche und Dateityp-Filter im Anhangsbereich
- Zum-Inhalt-Link und Fokusführung zum Hauptinhalt
- manuelles Aktualisieren mit ehrlichem Datenstand
- geladene Kommentare lokal durchsuchen
- Änderungsverlauf im Ticket aufklappbar anzeigen
- durchsuchbare Übersicht eigener und favorisierter Filter
- Tickets in der App erstellen

### Fehlerbehebung

- Bilddaten für die Anhangsvorschau bereitstellen
- Browser-Testverzeichnis nach Runner-Start festlegen
- Kontoziel anzeigen und kombinierte Browserprüfungen aktualisieren
- Kontocaches, Bereichseinstellungen und gemeinsame Aktionen verbinden
- temporären Ordner plattformübergreifend bestimmen
- Sortiersteuerung und Navigation sauber anbinden
- aktuelle Notizen und sichere Kontoaktionen bewahren
- bind actions and loaded details to the confirmed account
- isolate cached details by account and preserve recovery state
- guard permalink encoding and settle browser checks
- resume cached pages when comment total grows
- preserve scope and recover incomplete page reads
- reject metadata after account scope changes
- reset sorting and verify settled layouts
- Tab-Titel schlank per summary statt voller Ticketdetails laden
- preserve keyboard actions and restore dialog focus
- Sitzungs-, Board- und Linkfehler verständlich wiederherstellen
- check active session before system delivery
- bind pending writes to their originating filter
- Drosselung mit Retry-After verständlich melden statt sofort zu wiederholen
- Detailseite bei Sitzungs- und Ladefehlern wiederherstellbar
- refresh cached history after ticket changes
- fill short Jira pages without skipping changes
- discard non-text route search parameters
- recover from project loading failures

## 0.8.0 – 2026-11-07

### Neu

- Einträge aus Zuletzt entfernen mit Rückgängig
- lokaler Prüfstatus-Filter der geladenen Pull Requests
- Rollout als Vorlage duplizieren
- Updates-Bereich mit Automatik, manueller Suche und Rollback auf beliebige Version
- gespeicherte Beschreibung als Klartext kopieren
- lokale Suche in Einstellungen › Bereiche
- Spalten im Picker per Tastatur und Maus verschieben
- Arbeitskontexte lokal sortieren
- geladene Rollouts lokal durchsuchen
- lokale Sortierung der geladenen Pull Requests
- eigene Buchungen lokal durchsuchen
- verständliche Ansicht für unbekannte Seiten
- externe Links im Ticket einklappbar anzeigen
- Tastenkürzel-Hilfe durchsuchbar
- verknüpfte Tickets im Ticket anzeigen (#15)
- einfache Ticketsuche mit Projektwahl neben JQL (#14)
- Verbindungsübersicht und Offline-Hinweis (#13)
- eigene Jira-Buchungen nach Tag und Woche (#12)
- Inbox für lokal erfasste Jira-Aktivität (#11)
- durchsuchbare Bereichsübersicht unter /bereiche
- Übersicht aller verknüpften Repositories (#10)
- Textgröße für den Inhaltsbereich wählen
- lokale Arbeitskontexte als eigene Seite
- Ticket-Tabs bei 390 px im Menü verwalten
- Wiederherstellung nach Renderfehlern

### Fehlerbehebung

- Rückgängig ohne doppeltes Speichern abschließen
- Rollout-Fixture und exakte Titel-Locators korrigieren
- veraltete Handler sperren und Lesestellen erhalten
- getrennte Aktionen und vollständige Kopie-Titel sichern
- Tab beim Wechsel zwischen Tickets öffnen, Mittelklick ohne neues Fenster
- Verschieben mit Fokus und freien Klickzielen absichern
- gespeicherte Beschreibung robust als Text kopieren
- Sortierung und Kategorien erreichbar halten
- gleiche Titel stabil sortieren
- Suchtreffer und Suchaktionen klar bedienbar halten
- Suchzustand und Teilsummen eindeutig halten
- Hinweisaktionen im Layoutfluss statt absolut positioniert
- Dropdown-Untermenüs im Portal statt abgeschnitten im Hauptmenü
- discard non-text search values from route state
- show refresh failures for empty results
- Platzhalter und Ladefehler der Ticketliste sicher behandeln
- preserve visible retry button name
- Kopfleiste ohne Überdeckung in schmalen Fenstern
- Lesefehler der Sitzung nicht als Abmeldung zeigen

## 0.7.0 – 2026-11-06

### Neu

- Hauptnavigation und persönliche Jira-Tickets (#2)

## 0.6.0 – 2026-11-06

### Neu

- Rollout-Kalender mit lokaler Outlook-Anbindung

## 0.5.0 – 2026-11-06

### Neu

- Neues Update-Fenster unten rechts: zeigt die wichtigsten Neuerungen, die neue und die aktuelle Version und den Installationsfortschritt in Prozent.
- Updates lassen sich auf „Später“ verschieben oder einzeln überspringen, „Alle Release Notes“ öffnet die Versionsübersicht.
- Board: Insights-Panel mit wählbarer Messgröße, Gruppierung und Segment, dazu ein Anzeige-Menü sowie Status- und Prioritäts-Icons.

## 0.4.0 – 2026-11-06

### Neu

- Ticket-Tabs im Header wie im Browser: Jedes geöffnete Ticket bekommt einen Tab. Tabs lassen sich per Kontextmenü anheften, per Mittelklick schließen und bleiben nach einem Neustart erhalten. Strg/Cmd-Klick legt ein Ticket als Tab an, ohne es zu öffnen.
- Tastenkürzel: Strg/Cmd+1–9 und Strg+Tab wechseln Tabs, Strg/Cmd+W schließt den aktiven Tab, Zurück/Vor im Header und per Alt+Pfeil. `?` zeigt alle Kürzel, J/K springen durch Listen.
- Benachrichtigungen wie in Jira, getrennt nach „Direkt“ und „Beobachtet“ und gruppiert je Ticket.
- Board: Spalten lassen sich ein- und ausblenden, eine eigene Blocker-Lane zeigt blockierte Tickets.
- Neue Einstellungsseite „Darstellung“, Glas-Oberflächen für Menüs und Dialoge, auf macOS natives Fensterglas.
- Ticketansicht mit rechter Eigenschaftsspalte, Ladeplatzhalter und Seitenübergänge.

### Fehlerbehebung

- Kurzzeitige Jira-Fehler (Zeitüberschreitung, Rate-Limit) werden automatisch wiederholt.
- Nicht angemeldet: Die App fordert sauber zur Anmeldung auf.

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
