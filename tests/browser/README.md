# Browser-Prüfung ohne Jira-Konto

`bun run dev` starten und `http://localhost:1420/tests/browser/fixture.html` öffnen. Die Seite lädt die echte App mit drei lokalen Testtickets und einer simulierten Tauri-Bridge. Alle Jira-Anfragen bleiben in dieser Simulation. Die Daten sind ausdrücklich Testdaten; sie landen nicht in einem echten Jira.

Für die Tabelle: `http://localhost:1420/tests/browser/fixture.html?route=/bereiche/DEMO`.

Zum Neuladen immer die Fixture-URL öffnen. Die App ersetzt anschließend die Adresse durch ihre normale Route. Ein direktes Neuladen dieser normalen Route lädt die App ohne Tauri-Simulation. Auch ein vollständiger Vite-Neustart durch HMR kann deshalb ein erneutes Öffnen der Fixture erfordern.

## Automatische Prüfung

```sh
bun run test
bun run build
```

Browser-Tests: `bun run test:e2e`. Läuft parallel schon ein anderer Devserver auf Port 1420, `E2E_PORT` setzen (z. B. `E2E_PORT=1437`), sonst verwendet Playwright den fremden Server weiter.

`render-recovery.e2e.ts` injiziert Renderfehler ausschließlich im Test: Es fängt das von Vite ausgelieferte Komponentenmodul ab und schaltet den Fehler über `window.__qaRenderFault`. Geprüft werden Seiten-Fallback mit nutzbarer Shell, Retry, dauerhafter Fehler, Routenwechsel, Root-Fallback, Tastatur und reduzierte Bewegung. Mit `RENDER_RECOVERY_SHOTS=<Ordner>` speichert der Test zusätzlich Screenshots.

Am 04.11.2026: 103 Tests in 13 Dateien erfolgreich. Zusätzlich sind Feldentwürfe, Wiederaufnahme, begrenzte Kontextspeicherung und KI-Zustände abgedeckt. TypeScript und Produktionsbuild erfolgreich. Der Build meldet weiterhin einen großen Haupt-Chunk; der Effect-Sprachdienst gibt einen nicht blockierenden Hinweis zu einer bereits vorhandenen `Effect.succeed(undefined)`-Stelle aus.

## Im Browser geprüft

| Ablauf | Ergebnis |
| --- | --- |
| Kommentar schreiben und Vorlage ergänzen | Vorhandener Text bleibt erhalten |
| Fixture erneut öffnen | Entwurf, Pin und Kommentarreihenfolge wiederhergestellt |
| Anderes Ticket öffnen | Eigener Entwurf je Ticket; Verlauf aktualisiert |
| Ticket anheften und Command Palette öffnen | Eigene Gruppe oben, keine doppelten Treffer |
| Zuletzt geöffnetes, nicht angeheftetes Ticket | In eigener Suchgruppe vorhanden |
| Suche eingeben, schließen und wieder öffnen | Leeres Suchfeld; keine React-Warnung wegen fremder Zustandsänderung während des Renderns |
| Kommentarreihenfolge wechseln | Inhalt chronologisch korrekt umgeordnet |
| Kommentar bei simuliertem HTTP 503 absenden | Fehlermeldung; Text bleibt erhalten |
| Während einer verzögerten Anfrage weiterschreiben | Erfolg löscht den neueren Entwurf nicht |
| Entwurf verwerfen und Rückgängig wählen | Ursprünglicher Text wiederhergestellt |
| ⌘ + Enter und zwei zusätzliche Submit-Ereignisse während der Anfrage | Genau eine POST-Anfrage |
| Erfolgreich kommentieren | Kommentar erscheint; unveränderter Entwurf wird geleert |
| Einzelne Tabellenzeilen auswählen | Teilauswahl im Kopf; Ticket wird nicht geöffnet |
| Auswahl als Schlüssel, TSV und Markdown kopieren | Ausschließlich ausgewählte Zeilen, in Tabellenreihenfolge |
| Alle geladenen Tickets auswählen | Alle Checkboxen aktiv |
| Schnellfilter wechseln | Auswahl zurückgesetzt |
| Zeitkürzel und ungültige Dauer verwenden | Kürzel füllt Eingabe; ungültige Dauer wird erklärt |
| 30m buchen | Eine POST-Anfrage mit Dauer und Beginn samt Zeitzone |
| Desktop 1280 × 800, hell | Ticket und Tabelle visuell geprüft |
| Schmal 390 × 844, dunkel | Ticket, Kommentare und Auswahlleiste ohne Seitenüberlauf; Tabelle horizontal scrollbar |

Die neuen Bewegungen berücksichtigen `useReducedMotion`; für die mechanische UI-Prüfung wurden keine Befunde gemeldet. Ein nativer Tauri-Build, echte Jira-Berechtigungen und projektspezifische Pflichtfelder wurden in dieser Prüfung nicht ausgeführt.

## Fehler gezielt simulieren

In der Browserkonsole können diese ausschließlich lokalen Testschalter verwendet werden:

```js
window.__qa.failNextWrite = true;
window.__qa.delayMs = 600;
window.__qa.writes;
```

`failNextWrite` lässt genau den nächsten kommentierenden oder zeitbuchenden Schreibzugriff mit HTTP 503 scheitern. `delayMs` verzögert Schreibzugriffe in Millisekunden. `writes` enthält die erfolgreich simulierten Schreibzugriffe und ihre Payloads.

Pins, Verlauf und Entwürfe verwenden in dieser Simulation den separaten Arbeitsbereich `qa-cloud` / `qa-user` im lokalen Speicher. Die App speichert diese Daten bewusst je Jira-Konto und Instanz.


## Ticketlisten-Abfragen

`window.__qaSearchRule = (jql, pageToken) => ({ delayMs, status, keys, nextPageToken })` steuert einzelne Suchanfragen: verzögern, mit HTTP-Status scheitern lassen, Treffer auf Schlüssel begrenzen oder eine Folgeseite ankündigen. Per `addInitScript` gesetzt wirkt die Regel schon auf die erste Anfrage. `issue-query-states.e2e.ts` prüft damit Platzhalter nach Abfragewechsel, schnelle Wechsel, fehlgeschlagene Aktualisierung, ersten Ladefehler und fehlgeschlagenes Weiterladen. Mit `ISSUE_QUERY_SHOTS=<Ordner>` speichert der Test Screenshots.

## UX-Szenarien

- Board mit 64 Tickets, sechs Spalten und Insights: `http://localhost:1420/tests/browser/fixture.html?scenario=board&route=/bereiche/DEMO?board=1`. Geprüft am 06.11.2026: Insights öffnen und schließen, Messgröße/Gruppierung/Segment wechseln, Story-Point-Summe, Zeilenklick filtert das Board, Anzeige-Eigenschaften ein- und ausblenden, Ticket über das Status-Icon verschieben (Zahlen im Panel ziehen mit), hell/dunkel, 390 px, reduzierte Bewegung.

- Viele parallele Arbeitskontexte und langes Ticket: `http://localhost:1420/tests/browser/fixture.html?scenario=busy` (35 vorbereitete Kontexte, 12 offene Ticket-Tabs, einer angeheftet).
- Kopfleiste in schmalen Fenstern: `bunx playwright test tests/browser/header.e2e.ts --workers=1` prüft bei 390, 760, 1024 und 1440 px, dass sich keine Bedienelemente überdecken, sowie Suche, Einstellungen, „Weitere Aktionen“, Seitenleiste, Tastaturfokus und Tab-Wechsel.
- KI mit acht Vorschlägen und simuliertem Rückkanal: `http://localhost:1420/tests/browser/fixture.html?scenario=ai&route=/`.
- Reduzierte JS-Bewegung: `http://localhost:1420/tests/browser/fixture.html?scenario=busy&reduce=1`.

`window.__qa.briefingFailure = true` simuliert einen fehlgeschlagenen KI-Start. Erfolgreiche Starts liefern nach einer Sekunde ein neues, lokal erzeugtes Testbriefing über das simulierte Tauri-Ereignis. Es wird kein echter Agent gestartet. Ein aktiver Scheduler kann in diesem Szenario schon beim Öffnen einen Lauf beginnen.

Der vollständige Ablaufbericht einschließlich Vielnutzer, sorgfältigem Leser, Unterbrechungen und KI liegt in [docs/ux-arbeitsalltag.md](../../docs/ux-arbeitsalltag.md).

## Navigation und Jira-Tickets

- Ticket-Seite mit Ansichten: `http://localhost:1420/tests/browser/fixture.html?route=/tickets` (`?ansicht=beobachtet` bzw. `alle` über die Tabs).
- Abgemeldet: `...fixture.html?scenario=calendar-offline&route=/tickets`.
- Sitzung nicht lesbar (kein Logout): `...fixture.html?scenario=session-error&route=/tickets`; `window.__qa.sessionFailure = false` und „Erneut versuchen“ meldet wieder an.
- `window.__qa.searchDelayMs`, `window.__qa.emptySearch` und `window.__qa.failSearch` steuern Laden, leere Treffer und Abfragefehler; `window.__qa.searches` enthält die gesendeten JQL-Abfragen.
- Verzögerte Sitzung: `...fixture.html?scenario=session-slow&route=/` (`window.__qa.sessionDelayMs`, Standard 1500 ms in diesem Szenario).
- Übersicht und Seitenleiste zeigen einen Lesefehler der Sitzung ebenfalls als „Anmeldung konnte nicht geprüft werden“ mit Retry statt als Abmeldung. Der simulierte Login (`oauth_login`) bricht immer mit „Test: Anmeldung abgebrochen“ ab.
- Automatisch: `bunx playwright test tests/browser/navigation.e2e.ts tests/browser/session.e2e.ts --workers=1`.

## Benachrichtigungen

- Inbox mit lokal gespeicherten QA-Benachrichtigungen: `...fixture.html?scenario=notifications&route=/benachrichtigungen` (Filter über `?ansicht=beobachtet`, `?nur=ungelesen`, `?suche=`). Die Einträge sind reine Testdaten im lokalen Speicher, es werden keine Jira-Benachrichtigungen erzeugt.
- Fremdes Konto im lokalen Speicher: `scenario=notifications-foreign`. Die Seite zeigt keine Einträge des anderen Kontos.
- Automatisch: `bunx playwright test tests/browser/notifications.e2e.ts --workers=1`.
