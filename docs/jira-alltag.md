# Jira im Alltag vereinfachen

Die bestehende Oberfläche bleibt die Grundlage: Geist, semantische Farben, kompakte Werkzeugleisten, Inline-Bearbeitung, Command Palette und seitliche Detailansicht. Neue Funktionen sollen bestehende Handgriffe verkürzen und dort auftauchen, wo sie gebraucht werden.

Die vertiefte Prüfung und Umsetzung für Unterbrechungen, viele parallele Tickets und eine ruhigere Oberfläche steht in [UX im Arbeitsalltag](ux-arbeitsalltag.md).

## In dieser Änderung umgesetzt

1. **Tickets anheften.** Der Pin in der Ticket-Werkzeugleiste merkt wichtige Vorgänge. Sie stehen in der Suche über ⌘/Strg + K ganz oben.
2. **Zuletzt geöffnete Tickets.** Die Command Palette zeigt bis zu sechs zuletzt geöffnete, nicht bereits angeheftete Tickets. Der lokale Verlauf hält fünfzig Einträge und aktualisiert geänderte Titel.
3. **Ticketschlüssel direkt kopieren.** Eigener Button in der Ticket-Werkzeugleiste; Link kopieren bleibt daneben.
4. **Kommentarentwürfe automatisch behalten.** Text bleibt beim Ticketwechsel und Neustart erhalten. Entwürfe und Ticketlisten sind je Jira-Instanz und Benutzer getrennt.
5. **Drei Kommentarvorlagen.** Statusupdate, Rückfrage und Übergabe ergänzen den vorhandenen Text, statt ihn zu ersetzen.
6. **Entwürfe verwerfen und zurückholen.** Die Rückgängig-Aktion stellt den Text wieder her und erhält zwischenzeitlich neu geschriebenen Text.
7. **Kommentarreihenfolge merken.** Neueste oder älteste zuerst, mit animiertem Positionswechsel und lokal gespeicherter Auswahl.
8. **Sicherer kommentieren.** ⌘/Strg + Enter; Schutz vor mehrfach ausgelöstem Absenden; bei Fehlern bleibt der Text erhalten. Während des Speicherns weitergeschriebener Text wird nach Erfolg nicht gelöscht.
9. **Mehrere Tickets auswählen.** Einzelne Zeilen oder alle geladenen Ergebnisse markieren; der Tabellenkopf zeigt auch Teilauswahl an. Die Auswahl wird bei einer anderen Abfrage zurückgesetzt.
10. **Nur die Auswahl weitergeben.** Schlüssel, Tabelle für Excel/Numbers oder Markdown kopieren. Reihenfolge und Spalten entsprechen der aktuellen Ansicht. Noch nicht geladene Tickets werden nicht einbezogen.
11. **Zeit mit einem Klick vorbereiten.** Kürzel für 15m, 30m, 1h und 2h sowie „Beginn jetzt“. Vor dem tatsächlichen Buchen bleiben alle Angaben prüfbar.
12. **Zeiteingaben prüfen.** Jira-Einheiten w/d/h/m normalisieren; leere, negative, doppelte oder ungültige Einheiten und einen zukünftigen Beginn abfangen. Fehlgeschlagene Buchungen behalten die Eingaben.

Alle lokalen Daten bleiben auf diesem Gerät; es gibt für Pins, Verlauf und Entwürfe keine Synchronisierung zwischen Geräten.

## Als Nächstes: häufige Unterbrechungen reduzieren

| Idee | Konkreter Nutzen | Passender Ort im aktuellen UI |
| --- | --- | --- |
| Nächstes/vorheriges Ticket aus der Ergebnisliste | Eine Liste abarbeiten, ohne immer zurückzunavigieren | Ticket-Werkzeugleiste mit Positionsanzeige |
| „Mir zuweisen“ | Eine Aufgabe mit einem Klick übernehmen | Neben dem Bearbeiter, nur bei Berechtigung |
| Tagesfokus mit drei bewusst gewählten Tickets | Weniger parallele Arbeit | Bestehender Bereich „Jetzt“ auf der Startseite |
| Persönliche Wiedervorlage | Tickets nach einer Wartezeit wiedersehen | Ticket-Aktionsmenü und Benachrichtigungen |
| „Warte auf …“ mit Datum und Person | Blockierte Arbeit beim Tagesstart erkennen | Ticketdetails und Startseite |
| Ungelesene Änderungen seit dem letzten Besuch | Änderungen an Feldern und Kommentaren schneller überblicken | Dezente Markierungen im Ticket |
| Kommentar beantworten/zitieren | Rückfragen mit Kontext formulieren | Kleine Aktion am Kommentar |
| Eigene Kommentarvorlagen | Wiederkehrende Teamabläufe ohne Tipparbeit | Vorhandene Vorlagenzeile mit „Verwalten“ |
| Entwürfe als Suchgruppe | Angefangene Antworten schnell wiederfinden | Command Palette |
| Pins sortieren und direkt aus der Suche lösen | Eine kurze persönliche Arbeitsliste pflegen | Aktionsmenü an angehefteten Suchtreffern |
| Zwischenablage als Jira-Link erkennen | Ein kopierter Ticketlink reicht zum Öffnen | Suchfeld, nach Einfügen durch den Benutzer |
| Volltextsuche in Kommentaren eines Tickets | Entscheidungen ohne langes Scrollen finden | Kommentarabschnitt |

## Danach: Arbeit im Team bündeln

| Idee | Konkreter Nutzen | Umsetzungshinweis |
| --- | --- | --- |
| Status für eine Auswahl ändern | Routinearbeiten gesammelt erledigen | Gemeinsame verfügbare Übergänge prüfen; Teilerfolge anzeigen |
| Bearbeiter und Labels gesammelt setzen | Triage mit weniger Klicks | Bestehende Auswahlleiste erweitern; Berechtigungen prüfen |
| Persönliche Feldvoreinstellungen | Wiederkehrende Tickets schneller pflegen | Vorbelegung, kein automatisches Speichern |
| Ticket aus Vorlage erstellen | Vollständige Bugreports und Aufgaben | Projektabhängige Pflichtfelder berücksichtigen |
| Unteraufgaben aus einer Checkliste erstellen | Größere Aufgaben schnell aufteilen | Vorschau der entstehenden Aufgaben vor dem Anlegen |
| Übergabebericht für eine Auswahl | Stand, Risiken und nächste Schritte teilen | Markdown-Export um eine kompakte Zusammenfassung erweitern |
| Stand-up-Ansicht | Gestern erledigt, heute geplant, blockiert | Aus vorhandenen Status- und Verlaufsdaten ableiten |
| Vorschau verknüpfter Tickets | Abhängigkeiten ohne Kontextwechsel verstehen | Bestehenden Ticket-Tooltip wiederverwenden |
| Hinweise auf ähnliche offene Tickets | Doppelte Arbeit vermeiden | Vorschläge beim Erstellen; keine automatische Zusammenführung |
| Versions- und Release-Checkliste | Offene Arbeiten vor Veröffentlichung erkennen | Gespeicherte Ansicht für eine Version |
| Ticket in Slack/Teams als lesbaren Link kopieren | Kontext beim Weitergeben mitliefern | Neues Format im vorhandenen Kopiermenü |
| „Seit meiner letzten Antwort geändert“ | Gespräche priorisieren | Kommentarautor und Zeitstempel vergleichen |

## Später: anspruchsvollere Unterstützung

| Idee | Konkreter Nutzen | Voraussetzung |
| --- | --- | --- |
| Pausierbarer Arbeitstimer | Aufgewendete Zeit ohne Kopfrechnen erfassen | Sichtbarer aktiver Timer; Buchen ausschließlich nach Bestätigung |
| Wochenübersicht der gebuchten Zeit | Fehlende Buchungen erkennen | Vollständige, paginierte Worklogs und Zeitzonenbehandlung |
| Offline-Leseansicht | Bereits besuchte Tickets unterwegs ansehen | Alter der Daten sichtbar, Konto-Isolation und Bereinigung |
| Konflikthinweise beim Bearbeiten | Überschreiben fremder Änderungen verhindern | Vor dem Speichern aktuelle Feldwerte vergleichen |
| Feldbezogenes Rückgängig | Versehentliche Änderungen rasch korrigieren | Alte Werte und Berechtigungen prüfen; Jira-Aktion transparent auslösen |
| Gespeicherte Ansichten geräteübergreifend | Arbeitsplatzwechsel erleichtern | Explizites Synchronisationskonzept |
| Tastaturhilfe über „?“ | Bestehende Schnellaktionen entdecken | Nur außerhalb von Eingabefeldern aktivieren |
| Arbeitslast nach Fälligkeit | Drohende Engpässe früh erkennen | Verlässliche Fälligkeiten, keine künstlichen Dringlichkeitswerte |
| Persönliche Benachrichtigungsruhe | Fokusphasen vor Unterbrechungen schützen | Sichtbarer Zustand und zuverlässiges Nachholen |
| Zusammenfassung langer Diskussionen | Entscheidungen schneller verstehen | Quellenverweise auf Kommentare und bewusste KI-Aktivierung |
| Vorschlag für nächste konkrete Schritte | Unklare Tickets handhabbar machen | Als editierbaren Vorschlag zeigen; nie automatisch ausführen |
| Wöchentlicher Abschlussbericht | Eigene Ergebnisse ohne Zusatzarbeit sammeln | Zeitraum, Projekte und Ausgabe vorab einstellbar |

## Prüfung

Automatische Tests prüfen Konto-Trennung, Verlauf, Pins, Entwürfe, konkurrierende Entwurfsänderungen, Auswahl und Zeitvalidierung. Der Produktionsbuild prüft TypeScript und die gebündelte Anwendung.

Die Browser-Testumgebung unter `tests/browser/fixture.html` simuliert Jira und Tauri lokal. Sie erlaubt Tests erfolgreicher und fehlgeschlagener Schreibaktionen, ohne ein echtes Jira-Konto zu verwenden. Das ersetzt keinen Integrationstest gegen eine echte Jira-Instanz mit deren individuellen Feldern und Berechtigungen.
