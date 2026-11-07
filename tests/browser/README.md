# Browser-Prüfung ohne Jira-Konto

`bun run dev` starten und `http://localhost:1420/tests/browser/fixture.html` öffnen. Die Seite lädt die echte App mit drei lokalen Testtickets und einer simulierten Tauri-Bridge. Alle Jira-Anfragen bleiben in dieser Simulation. Die Daten sind ausdrücklich Testdaten; sie landen nicht in einem echten Jira.

Für die Tabelle: `http://localhost:1420/tests/browser/fixture.html?route=/bereiche/DEMO`.

Zum Neuladen immer die Fixture-URL öffnen. Die App ersetzt anschließend die Adresse durch ihre normale Route. Ein direktes Neuladen dieser normalen Route lädt die App ohne Tauri-Simulation. Auch ein vollständiger Vite-Neustart durch HMR kann deshalb ein erneutes Öffnen der Fixture erfordern.

## Tastenkürzel-Hilfe

- `...fixture.html?route=/settings/darstellung` und „Übersicht öffnen“ oder <kbd>?</kbd> drücken. Das Suchfeld findet Aktionen („Zurück“), Bereiche („Navigation“) und angezeigte Tasten, auch über übliche Namen wie „Strg“, „Cmd“, „Option“ oder „Enter“. Einzelne Zeichen gelten als Taste oder Wortanfang, damit „g h“ genau die Tastenfolge findet.
- <kbd>Esc</kbd> leert zuerst die Suche und schließt erst danach den Dialog.
- Automatisch: `bunx playwright test tests/browser/shortcut-help.e2e.ts --workers=1`; mit `SHORTCUT_HELP_SHOTS=<Ordner>` zusätzlich Screenshots.

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

Mit `headers` liefert eine scheiternde Suchregel zusätzlich Antwort-Header, z. B. `{ status: 429, headers: { "retry-after": "120" } }`. `rate-limit.e2e.ts` prüft damit die Drosselung durch Jira: verständliche Meldung mit frühestem Zeitpunkt, keine automatischen Sofort-Wiederholungen, keine Abmeldung, erhaltene Zeilen beim Aktualisieren und Erholung über „Erneut versuchen“. Mit `RATE_LIMIT_SHOTS=<Ordner>` speichert der Test Screenshots (schmales Profil in 390 px).

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

## Bereichsseite und Boards

- Board: `...fixture.html?scenario=board&route=/bereiche/DEMO?board=1`. `window.__qaBoardType = "scrum"` (per `addInitScript`) liefert dasselbe Board als Scrum-Board mit lokalem „Sprint 5“ für Sprint- und Backlog-Wechsel.
- `window.__qaBoardRule = (path) => ({ delayMs, status })` verzögert oder scheitert Agile-Abrufe unter `/board` (Boardliste: `path === "/board"`, Board-Konfiguration: `path.endsWith("/configuration")`). `window.__qa.boardReads` protokolliert die gelesenen Pfade.
- Unbekanntes Board: `?route=/bereiche/DEMO?board=999`. Die Seite sagt nur, dass es unter den geladenen Boards fehlt; die Boardliste wird von Jira auf eine Seite (50 Boards) begrenzt geladen.
- Ungültige Links wie `?board=abc` oder `?sprint=openSprints()` werden verworfen und gelangen nicht in JQL oder Agile-Pfade.
- Automatisch: `bunx playwright test tests/browser/area-recovery.e2e.ts --workers=1`; mit `AREA_RECOVERY_SHOTS=<Ordner>` zusätzlich Screenshots.

## Filter

- Zwei lokale Testfilter (`100` „Offene Testtickets“, `200` „Team-Rückstand“, beide von `qa-user`): `...fixture.html?scenario=filters&route=/filter/100`. Nur `scenario=filters` listet sie in der Seitenleiste; die Detailseite liest sie in jedem Szenario, z. B. `scenario=session-error&route=/filter/100`.
- `window.__qaFilterRule = (id) => ({ delayMs, status })` lässt `GET /filter/{id}` verzögern oder mit HTTP-Status scheitern. `window.__qa.filterReads` protokolliert gelesene Filter-IDs, Speichern landet als `PUT /filter/{id}` in `window.__qa.writes`.
- Automatisch: `bunx playwright test tests/browser/filter-recovery.e2e.ts --workers=1` prüft Sitzung langsam/abgemeldet/Lesefehler, ersten 503 mit Retry, 403/404, gescheiterten Refresh mit Entwurf, Wechsel A → B ohne fremden Entwurf und normales Speichern. `FILTER_RECOVERY_SHOTS=<Ordner>` speichert Screenshots.

## Verknüpfte Tickets

`DEMO-1` hat lokale Testverknüpfungen in beide Richtungen (`blocks`, `is blocked by`, `relates to`), ein Ticket ohne Felder (`OPS-7`), einen doppelten Eintrag und eine unlesbare Verknüpfung. `window.__qaIssueLinksRule = (key) => ({ delayMs, status, issuelinks })` steuert die Abfrage `GET /issue/{key}?fields=issuelinks`; `window.__qa.issueReads` protokolliert alle gelesenen Ticketpfade. Automatisch: `bunx playwright test tests/browser/issue-links.e2e.ts --workers=1` (mit `ISSUE_LINKS_SHOTS=<Ordner>` zusätzlich Screenshots).

## Externe Links

`DEMO-1` hat lokale Test-Remote-Links (`GET /issue/{key}/remotelink`): eine Confluence-Seite, eine erledigte Spezifikation mit langem Titel und HTML-Text, ein `javascript:`-Ziel, ein fehlendes Ziel, ein Ziel mit Zugangsdaten und einen unlesbaren Eintrag. `DEMO-2` hat keine. Der Abschnitt ist eingeklappt und fragt erst beim Aufklappen an. `window.__qaRemoteLinksRule = (key) => ({ delayMs, status, links })` steuert die Abfrage, `window.__qa.opened` enthält die per Opener geöffneten Ziele; es wird keine echte Seite geöffnet. Automatisch: `bunx playwright test tests/browser/remote-links.e2e.ts --workers=1` (mit `REMOTE_LINKS_SHOTS=<Ordner>` zusätzlich Screenshots).

## Ticketsuche

- Einfache Suche: `...fixture.html?route=/suche` (alle Projekte), `?route=/suche?projekt=DEMO&q=Übergabe` (Projekt und Text aus der URL), JQL-Modus: `?route=/suche?modus=jql` oder alte Links `?route=/suche?jql=...`.
- `window.__qaProjects` (per `addInitScript`) ersetzt die simulierte Projektliste, z. B. für die Projektwahl mit mehreren Projekten.
- Automatisch: `bunx playwright test tests/browser/simple-search.e2e.ts --workers=1`; mit `SIMPLE_SEARCH_SHOTS=<Ordner>` zusätzlich Screenshots.

## Suche in geladenen Rollouts

- Kalender mit lokalen QA-Rollouts: `...fixture.html?scenario=rollout-search&route=/kalender` (Produktion Release 2.4 mit `DEMO-1`, Datenbank Migration im Dezember mit `OPS-7`, Wartungsfenster mit Sonderzeichen, zehn Hotfix-Releases im Oktober). Die Rollouts werden nur angelegt, wenn der lokale Speicher noch keine Rollouts enthält; sie sind reine Testdaten und werden nicht nach Outlook oder Jira geschrieben.
- Suchtext aus der URL: `?route=/kalender?q=Migration`. Die Suche durchsucht nur die bereits geladenen Rollouts nach Titel, Notiz und Ticket-Schlüssel, keine Outlook-Termine und kein Jira.
- Automatisch: `bunx playwright test tests/browser/rollout-search.e2e.ts --workers=1` prüft Trefferliste ohne Änderung an Kalender und Tagesagenda, mehrere Wörter, Groß/Klein und Sonderzeichen, Tageswahl in anderen Monaten, „Weitere anzeigen“ mit Zurücksetzen bei neuer Suche, keine zusätzlichen Lese- oder Schreibzugriffe durch Eingabe, URL mit Zurück/Vorwärts und Zurücksetzen, Ladefehler, Tastatur sowie 390 px hell und dunkel. Mit `ROLLOUT_SEARCH_SHOTS=<Ordner>` speichert der Test Screenshots.

## Rollout als Vorlage duplizieren

- Kalender mit zwei lokalen QA-Rollouts: `...fixture.html?scenario=rollout-duplicate&route=/kalender`. „Produktion Release 2.4“ ist mit dem simulierten Outlook-Kalender verknüpft (`DEMO-1`, Notiz, Erinnerung 1 Stunde), „Partner-Rollout“ gehört zu einer fremden Jira-Site (`EXT-4`). Das Szenario legt die Daten nur an, wenn der lokale Speicher noch keine Rollouts enthält; es sind reine Testdaten ohne Outlook- oder Jira-Schreibzugriff.
- „Weitere Aktionen“ am Rollout → „Als Vorlage duplizieren“ öffnet den bekannten Dialog mit „(Kopie)“ im Titel und übernommenem Inhalt. Erst „Anlegen“ speichert einen neuen lokalen Rollout mit neuer ID und ohne Outlook-Verknüpfung; „Abbrechen“ und Escape schreiben nichts.
- Automatisch: `bunx playwright test tests/browser/rollout-duplicate.e2e.ts --workers=1` prüft vorbefüllte Werte, keine Schreibzugriffe vor dem Speichern oder beim Abbrechen, genau einen neuen Eintrag bei doppeltem Absenden, unverändertes Original, keine Outlook- und Jira-Schreibaufrufe, ehrliche Anzeige der fremden Site ohne zusätzliche Ticketsuche, Tastatur, Tooltip, 32 px Trefferfläche sowie Desktop hell und 390 px hell und dunkel. Mit `ROLLOUT_DUPLICATE_SHOTS=<Ordner>` speichert der Test Screenshots.

## Verbindungen und Offline-Hinweis

- Übersicht: `http://localhost:1420/tests/browser/fixture.html?route=/settings/verbindungen` (abgemeldet mit `scenario=calendar-offline`, Lesefehler mit `scenario=session-error`).
- `window.__qa.failMyself`, `window.__qa.myselfDelayMs` und `window.__qa.myselfCalls` steuern bzw. zählen die Jira-Prüfung (`/myself`). `window.__qaGhHosts` (per `addInitScript`) liefert die Antwort von `gh auth status`. `window.__qa.commands` listet alle simulierten Tauri-Kommandos.
- Automatisch: `bunx playwright test tests/browser/connections.e2e.ts --workers=1`. Mit `CONNECTIONS_SHOTS=<Ordner>` speichert der Test Screenshots.
- Offline wird nur im Browser simuliert: Der Test überschreibt `navigator.onLine` und löst `offline`/`online` aus. Das ersetzt keine native Netzprüfung; ob Atlassian, GitHub oder Bitbucket tatsächlich erreichbar sind, zeigt nur die jeweilige Prüfung. In der Simulation pausiert TanStack Query wie im echten Offline-Fall, auch für die lokalen Abfragen von GitHub CLI und Outlook.

## Meine Zeiterfassung

- Lokale Testbuchungen: `...fixture.html?scenario=time-tracking&route=/zeiterfassung` (eigene Buchungen in der Woche ab 02.11.2026, eine fremde Buchung, eine aus der Vorwoche).
- `window.__qaWorklogRule = (key) => ({ status, delayMs, pageSize })` lässt Worklog-Abrufe einzelner Tickets scheitern, verzögern oder in kleinen Seiten antworten.
- Automatisch: `bunx playwright test tests/browser/time-tracking.e2e.ts --workers=1`; `TIME_TRACKING_SHOTS=<Ordner>` speichert Screenshots.
- Suche in eigenen Buchungen: `...fixture.html?scenario=time-tracking&route=/zeiterfassung?q=Review`. Gefiltert wird nur lokal in den bereits geladenen eigenen Buchungen (Ticketschlüssel, Titel, Kommentar); `window.__qaReads`, per `addInitScript` als Array gesetzt, bleibt beim Tippen unverändert. „Summe Woche“ zeigt weiter die ganze Woche, „Summe Treffer“ nur die Treffer. Die Tests unter „Suche in eigenen Buchungen“ prüfen außerdem URL-Verlauf, Tastatur, Sonderzeichen, Teilfehler sowie Desktop hell und 390 px dunkel mit reduzierter Bewegung.

## Benachrichtigungen

- Inbox mit lokal gespeicherten QA-Benachrichtigungen: `...fixture.html?scenario=notifications&route=/benachrichtigungen` (Filter über `?ansicht=beobachtet`, `?nur=ungelesen`, `?suche=`). Die Einträge sind reine Testdaten im lokalen Speicher, es werden keine Jira-Benachrichtigungen erzeugt.
- Fremdes Konto im lokalen Speicher: `scenario=notifications-foreign`. Die Seite zeigt keine Einträge des anderen Kontos.
- Automatisch: `bunx playwright test tests/browser/notifications.e2e.ts --workers=1`.

## Pull Requests

- Seite mit GitHub (lokal simulierte `gh`-Anmeldung) und Bitbucket Cloud: `...fixture.html?scenario=scm&route=/pull-requests`. Alle Repositories und Pull Requests sind ausschließlich lokale QA-Daten (`qa/web-app`, `qa/design-system`, `qa-team/api`); `scm_request` verlässt die Simulation nie.
- Teilfehler: `scenario=scm-partial` (Bitbucket antwortet mit 503, ein Link zeigt auf eine fehlende Verbindung). `window.__qaScm.failRepos = []` und „Erneut versuchen“ lädt das Repository nach.
- `scenario=scm-slow` verzögert jede Antwort um 1,2 s, `scenario=scm-empty` zeigt die Einrichtung ohne Verbindung, `scenario=scm-offline` prüft die Seite ohne Jira-Sitzung.
- `window.__qaScm.requests` enthält die gesendeten SCM-URLs, `window.__qaScm.opened` die im Browser geöffneten Links.
- Sortierung: `...fixture.html?scenario=scm&route=/pull-requests?sort=title` (`updated-asc`, `title`, `repo`; ohne `sort` oder bei ungültigem Wert „Zuletzt aktualisiert“). Sortiert werden nur die bereits geladenen Pull Requests; `window.__qaScm.requests` bleibt beim Sortieren unverändert. Jeder Sortierwechsel ist ein eigener Verlaufseintrag, Sucheingaben ersetzen den aktuellen.
- Prüfstatus: `scenario=scm-checks` ergänzt in `qa/design-system` drei offene Pull Requests ohne verwertbare Prüfdaten (#14 ohne Rollup, #15 mit unbekanntem Rollup-Zustand `QA_UNBEKANNT`, #16 ohne Commit). Filter über `...&route=/pull-requests?checks=failure` (`failure`, `pending`, `success`, `unknown` = „Keine Angabe“; ohne `checks` oder bei ungültigem Wert „Alle Prüfstatus“). Gefiltert werden nur die bereits geladenen Pull Requests vor der Sortierung; `window.__qaScm.requests` bleibt unverändert. Jeder Wechsel und „Prüfstatus zurücksetzen“ ist ein eigener Verlaufseintrag. Mit `scenario=scm-partial&route=/pull-requests?checks=pending` erscheinen Teilfehler, Grenzhinweis und der leere Prüfstatus gemeinsam.
- Automatisch: `bunx playwright test tests/browser/pull-requests.e2e.ts --workers=1`; mit `PULL_REQUEST_SHOTS=<Ordner>` entstehen Screenshots.

## Arbeitsplatz

- Seite mit lokalen QA-Kontexten (10 zuletzt geöffnete Tickets, zwei Pins, ein Kommentarentwurf, eine Notiz, zwei Feldentwürfe, davon einer ohne bekannte Details): `...fixture.html?scenario=workspace&route=/arbeitsplatz`. Filter über `?art=angeheftet|entwuerfe|notizen|zuletzt`, Suche über `q`.
- Zweites Konto derselben Instanz: `&account=qa-colleague`. Es sieht nur seinen eigenen QA-Kontext; die Daten von `qa-user` bleiben unverändert im lokalen Speicher.
- Abmelden simuliert `session_delete`; danach meldet die Sitzung bis zum erneuten Öffnen der Fixture „Nicht angemeldet“.
- Automatisch: `bunx playwright test tests/browser/workspace-page.e2e.ts --workers=1`. Mit `WORKSPACE_SHOTS=<Ordner>` speichert der Test Screenshots.
- Sortierung über `?sort=geoeffnet|schluessel|titel` (ohne Parameter oder bei unbekanntem Wert: Standard), kombinierbar mit `art` und `q`. Im Szenario `workspace` zeigt vor allem „Titel“ eine sichtbar andere Reihenfolge. Die Sortiertests legen per `addInitScript` einen eigenen, gemischten QA-Kontext an (`DEMO-10`, `DEMO-2`, `DEMO-9` im Verlauf mit unterschiedlichen Öffnungszeiten, `DEMO-11` nur angeheftet, `DEMO-1` nur als Entwurf ohne Details) und prüfen Reihenfolge, Verlauf, Filter, DOM-Erhalt und dass keine `/search`- oder `/issue`-Abfragen entstehen.
- Aus Zuletzt entfernen: Die X-Aktion („`<Schlüssel>` aus Zuletzt entfernen“) erscheint nur bei Einträgen im Verlauf. Im Szenario `workspace` bleiben `DEMO-2` (Pin, Feldentwurf), `DEMO-3` (Kommentarentwurf) und `DEMO-4` (Notiz) nach dem Entfernen unter „Alle“ sichtbar, `DEMO-1` verschwindet samt Zeile; seine Lesestelle bleibt im lokalen Speicher. Die Tests prüfen Filterzähler, unveränderte Notizen, Entwürfe, Feldentwürfe und Pins, Fokus auf den Nachbarn in sortierter Reihenfolge bzw. die Suche, Rückgängig an der ursprünglichen Stelle auch nach erneutem Öffnen eines anderen Tickets, Rückgängig nach Abmelden nur ins Ursprungskonto, Tastatur sowie 390 px hell und dunkel (`WORKSPACE_SHOTS`: `*-remove-recent-390-light|dark.png`).

## Dropdown-Untermenüs

- Tabelle: `...fixture.html?route=/bereiche/DEMO`, dort „Ansicht und Export“ → „Kopieren als“ sowie „Filter“ → „Status“.
- Untermenüs werden in einem eigenen Portal gerendert. Vorher lagen sie im Hauptmenü: Dessen `backdrop-filter` machte es zum Bezugsrahmen der Positionierung, und `overflow-x-hidden` schnitt das Untermenü ab. Passt ein Untermenü auf keiner Seite neben das Hauptmenü (z. B. bei 390 px), überlappt es das Hauptmenü und bleibt 8 px vom Fensterrand entfernt.
- Automatisch: `bunx playwright test tests/browser/dropdown-submenus.e2e.ts --workers=1` (Projektbreite und 390 px; Mausklick mit Zwischenablage, Mauswechsel zwischen Haupt- und Untermenü, Pfeiltasten/Enter/Escape mit Fokusrückgabe, Statusfilter). Jeder Eintrag muss im Fenster liegen und an seinem Mittelpunkt und beiden Rändern selbst getroffen werden. Mit `DROPDOWN_SUBMENU_SHOTS=<Ordner>` speichert der Test Screenshots.
- Am 07.11.2026 gegen den gebauten Stand (`vite preview`) geprüft: mit der Korrektur 16 von 16 Tests erfolgreich, mit dem alten `dropdown-menu.tsx` 16 von 16 rot. Auf Desktop war das Untermenü vollständig abgeschnitten, bei 390 px lag es bei x = −74 bzw. reichte bis 436 px. `issue-query-states.e2e.ts` und `header.e2e.ts` laufen weiter durch. Ausnahme ist „Geöffnete Tickets im Menü sind per Tastatur bedienbar“ (390 px, reduziert): Der Test scheitert gelegentlich, weil die Schleife ArrowDown drückt, ohne auf den Fokus zu warten. Für dieses Menü ändert die Korrektur kein CSS.
- Mausbewegungen im Test laufen schrittweise. Radix erkennt die Richtung zum Untermenü aus aufeinanderfolgenden `pointermove`-Ereignissen; ein einzelner Sprung über das Hauptmenü hinweg schließt ein links liegendes Untermenü, wie bei echter Maus ein abrupter Sprung auch.

## Projektfavoriten je Konto

- Favoriten und ausgeblendete Bereiche gelten je Jira-Instanz und Konto (`cloudId` + `accountId`). Zweites Konto: `&account=qa-colleague`, zweite Instanz: `&cloud=other-cloud`.
- Einstellungen: `...fixture.html?route=/settings/bereiche`. Alte globale Daten (`betterjira-favorites` mit `projectIds`/`hiddenProjectIds`) erscheinen dort als einmaliges Angebot „Übernehmen“/„Verwerfen“ (mit Rückgängig) und werden nie automatisch einem Konto zugeordnet.
- `window.__qaMyselfDelayMs` und `window.__qaFailMyself` (per `addInitScript`) verzögern bzw. scheitern die erste Kontoprüfung (`/myself`).
- Automatisch: `bunx playwright test tests/browser/project-prefs.e2e.ts --workers=1`; mit `PROJECT_PREFS_SHOTS=<Ordner>` zusätzlich Screenshots.

## Bereichsübersicht

- Sieben Testbereiche, ein Favorit (Betrieb) und ein in der Seitenleiste ausgeblendeter Bereich (Archiv 2024): `...fixture.html?scenario=projects&route=/bereiche`.
- `window.__qaProjectRule = () => ({ delayMs, status, values })` steuert die Projektabfrage (verzögern, mit HTTP-Status scheitern, andere Bereiche liefern, etwa für einen Kontowechsel). `window.__qaReads`, per `addInitScript` als Array gesetzt, sammelt alle gelesenen Pfade.
- Automatisch: `bunx playwright test tests/browser/projects.e2e.ts --workers=1` prüft Suche und Ansicht in der URL mit Zurück/Vorwärts, Favoriten synchron mit der Seitenleiste, ausgeblendete Bereiche, Ladefehler und fehlgeschlagene Aktualisierung mit Retry, Abmelden und Kontowechsel, Tastatur und Command Palette sowie Desktop hell und 390 px dunkel. Mit `PROJECTS_SHOTS=<Ordner>` speichert der Test Screenshots.

## Einstellungen › Bereiche: Suche

- Lokale Suche nach Name oder Schlüssel der bereits geladenen Bereiche: `...fixture.html?scenario=projects&route=/settings/bereiche` (Direktlink mit Suche: `route=/settings/bereiche?q=ops`). Die Suche sendet keine zusätzliche Jira-Anfrage und schreibt keine Bereichs-Einstellungen; Stern und Schalter nutzen dieselben Aktionen wie Seitenleiste und Bereichsübersicht.
- Leere Bereichsliste: `window.__qaProjectRuleValue = { values: [] }` per `addInitScript` (zusammen mit `__qaProjectRule` wie in `projects.e2e.ts`). Lesefehler der Sitzung: `scenario=session-error`, abgemeldet: `scenario=calendar-offline`.
- Automatisch: `bunx playwright test tests/browser/project-settings.e2e.ts --workers=1` prüft Direktlink und ungültige `q`-Werte, URL mit Zurück/Vorwärts, keine zusätzlichen GET-Anfragen oder Einstellungs-Schreibzugriffe beim Suchen, Stern und Sichtbarkeit synchron mit der Seitenleiste, Tastatur, Laden, leere Liste, Lade- und Aktualisierungsfehler mit Retry, Sitzungsfehler und Abmeldung sowie Desktop hell und 390 px dunkel. Mit `PROJECT_SETTINGS_SHOTS=<Ordner>` speichert der Test Screenshots.

## Beschreibung kopieren

- `window.__qaDescriptions = { "DEMO-1": adf, "DEMO-2": null }` (per `addInitScript`) ersetzt die gespeicherte Beschreibung einzelner Testtickets vor dem Laden, etwa für reichhaltiges ADF, eine fehlende oder eine leere Beschreibung.
- „Weitere Ticketaktionen“ → „Beschreibung kopieren“ schreibt den bereits geladenen gespeicherten Stand als Klartext in die Zwischenablage, ohne weitere Jira-Anfrage; ein offener Editorentwurf wird nicht verwendet.
- Automatisch: `bunx playwright test tests/browser/description-copy.e2e.ts --workers=1` liest die echte Zwischenablage byteweise zurück, prüft `window.__qa.issueReads` und `window.__qa.writes` auf zusätzliche Jira-Zugriffe, deaktivierte Aktion mit Erklärung, Doppelauslösung, Fehler der Zwischenablage sowie Desktop hell und 390 px dunkel. Mit `DESCRIPTION_COPY_SHOTS=<Ordner>` speichert der Test Screenshots.

## Spalten-Picker

- Tabelle öffnen: `...fixture.html?route=/bereiche/DEMO`, dann „Spalten“. Jede angezeigte Spalte hat bei Hover oder Fokus „nach oben/unten verschieben“; an den Enden sind die Aktionen deaktiviert (`aria-disabled`), der Fokus bleibt auf der gedrückten Aktion.
- Die Reihenfolge landet im lokalen Speicher `betterjira-issue-views` (derselbe Pfad wie beim Ziehen) und bleibt nach erneutem Öffnen der Fixture erhalten. Es entstehen keine Jira-Schreibzugriffe (`window.__qa.writes` bleibt leer).
- Automatisch: `bunx playwright test tests/browser/column-picker.e2e.ts --workers=1` prüft Tastatur, Maus, Ziehen, Feld hinzufügen/entfernen, Tabellenspalten, Neuladen sowie 390 px dunkel mit reduzierter Bewegung. Mit `COLUMN_PICKER_SHOTS=<Ordner>` speichert der Test Screenshots.

## Hinweise mit Aktionen

- `alert-actions.e2e.ts` prüft die echten Hinweise mit Wiederholaktion: fehlgeschlagene Tabellenaktualisierung (simulierter HTTP 503), „Jira konnte zuletzt nicht geprüft werden“ in den Benachrichtigungen (ohne Icon) und „Projekt „NOPE“ ist nicht verfügbar“ in der Suche (lange Beschriftung). Gemessen werden Textzeilen, Icon und Aktion gegeneinander sowie der Treffer der Aktion per `elementFromPoint`; dazu Tastaturfokus aus dem Text und Retry per Enter bzw. Maus.
- Desktop hell (1440 px): Aktion kompakt rechts neben dem Text. 390 px dunkel mit reduzierter Bewegung, auch mit Textgröße „Sehr groß“: Aktion unter dem Text, ohne Seitenüberlauf. Aktionen sind mindestens 32 px hoch.
- Automatisch: `bunx playwright test tests/browser/alert-actions.e2e.ts --project=desktop --workers=1`; mit `ALERT_ACTIONS_SHOTS=<Ordner>` zusätzlich Screenshots (erst nach `document.fonts.ready` und geladener Geist-Schrift).

## Unbekannte Routen

- Direktlink auf eine nicht vorhandene Ansicht: `...fixture.html?route=/gibt-es-nicht?token=test`. Kopfzeile und Seitenleiste bleiben, die Seite zeigt weder Pfad noch Parameter, die URL bleibt unverändert. „Zurück“ erscheint nur nach einer Navigation innerhalb der App.
- Automatisch: `bunx playwright test tests/browser/not-found.e2e.ts --workers=1`; mit `NOT_FOUND_SHOTS=<Ordner>` zusätzlich Screenshots.

## Tastaturzugang zum Hauptinhalt

- Beim ersten Tab erscheint „Zum Inhalt“; Enter fokussiert den benannten Hauptbereich (`main` „Hauptinhalt“) ohne Hash, Verlaufseintrag oder Scrollsprung.
- Nach einem Seitenwechsel wird der Hauptbereich nur fokussiert, wenn der Fokus durch den Wechsel verloren ging (z. B. Link im Inhalt, Zurück/Vorwärts). Fokus in Seitenleiste, Kopfzeile, Dialogen oder auf „Erneut versuchen“ bleibt stehen, ebenso bei Query-Wechsel und Aktualisieren.
- Automatisch: `bunx playwright test tests/browser/main-content-focus.e2e.ts --workers=1`.

## Ticket erstellen

- Formular: `http://localhost:1420/tests/browser/fixture.html?scenario=create&route=/neu`. Projekte: „Produktentwicklung“ (Aufgabe mit Pflichtfeldern Priorität und Kunde, Fehler mit Pflichtfeld Umgebung, Unteraufgabe nur in Jira), „Betrieb“ (Pflichtfeld Team, nicht unterstützt) und „Archiv ohne Rechte“ (keine Create-Berechtigung).
- `window.__qa.createFailure = { status, body }` lässt den nächsten `POST /issue` einmalig scheitern, `window.__qa.metaDelay = { "<projektId>": ms }` verzögert die Create-Metadaten, `window.__qa.opened` sammelt geöffnete Jira-Links. Erstellte Tickets bleiben in der Simulation.
- Automatisch: `bunx playwright test tests/browser/create-issue.e2e.ts --workers=1`; mit `CREATE_ISSUE_SHOTS=<Ordner>` zusätzlich Screenshots.

## Filterübersicht

- Eigene und favorisierte QA-Filter: `...fixture.html?scenario=filters&route=/filter` (sieben Filter, davon drei Favoriten, einer gehört einem anderen Konto). Ansicht über `?ansicht=favoriten`, Suche über `q`.
- Erster Ladefehler: `&fail=filters`; `window.__qa.failFilters` schaltet Fehler von `/filter/my` zur Laufzeit, `window.__qa.filterRequests` zählt die Abrufe.
- Favoriten-Schreibzugriffe (`PUT`/`DELETE /filter/{id}/favourite`) bleiben in der Simulation und stehen in `window.__qa.writes`; `failNextWrite` und `delayMs` wirken auch hier.
- Zweites Konto: `&account=qa-colleague` sieht nur seinen eigenen Filter.
- Automatisch: `bunx playwright test tests/browser/filter-overview.e2e.ts --workers=1`. Mit `FILTER_SHOTS=<Ordner>` speichert der Test Screenshots und prüft, dass die Schrift geladen ist.

## Bereiche sortieren

`http://localhost:1420/tests/browser/fixture.html?scenario=projects&route=/bereiche?sort=name` öffnet die Bereichsübersicht direkt mit Sortierung. Gültige Werte für `sort`: `name`, `schluessel`, `favoriten`; ohne Parameter oder bei unbekanntem Wert gilt die geladene Reihenfolge. `projects.e2e.ts` prüft Reihenfolge je Sortierung, Tastaturbedienung, URL mit Suche und Ansicht, Zurück/Vorwärts, Direktlink, dass Zeilen beim Umordnen nicht neu eingehängt werden und dass keine zusätzlichen Projekt-, Board- oder Ticketanfragen entstehen. Die Fixture-Daten bleiben unverändert.

## Übersicht aktualisieren

- Übersicht: `...fixture.html?route=/`. Der Knopf neben dem Stand lädt Tickets und Profil (bei Favoriten auch die Bereiche) erneut; während des Abrufs löst ein weiterer Klick keinen zweiten Abruf aus.
- `window.__qaSearchRule = (jql) => jql.includes("resolved >= -7d") ? { status: 400 } : {}` lässt nur die Arbeitsliste scheitern (Teilfehler), zusammen mit `window.__qa.failMyself = true` scheitern alle Abfragen. Geladene Tickets bleiben sichtbar, der Stand bleibt beim letzten erfolgreichen Abruf.
- Automatisch: `bunx playwright test tests/browser/dashboard-refresh.e2e.ts --workers=1` prüft initiales Laden, Initialfehler mit Retry, Aktualisieren und Doppelklick, vollständigen und teilweisen Refreshfehler mit Retry, leere Liste mit Fehler, offline/online sowie Tastatur und 390 px. `DASHBOARD_SHOTS=<Ordner>` speichert Screenshots.

## Änderungsverlauf im Ticket

- `...fixture.html?route=/issue/DEMO-1`, unten „Änderungsverlauf“ aufklappen. DEMO-1 hat 48 lokale Testeinträge (u. a. mehrere Felder in einer Änderung, gelöschte und unbekannte Person, rohe Feld-ID, Beschreibung mit Markup als Text), DEMO-2 keinen, DEMO-3 drei. Eingeklappt wird nichts abgerufen.
- `window.__qaHistory.reads` enthält die gesendeten Changelog-Anfragen (`startAt`, `maxResults`, Konto). `window.__qaHistoryRule = (key, startAt, account) => ({ delayMs, status, html, values })` verzögert, lässt einzelne Seiten scheitern oder ersetzt die Einträge.
- Automatisch: `bunx playwright test tests/browser/issue-history.e2e.ts --workers=1`; mit `ISSUE_HISTORY_SHOTS=<Ordner>` entstehen Screenshots.

## Kommentare nachladen

- Ticket mit 7 lokalen Testkommentaren, von denen die Detailabfrage nur 2 liefert: `...fixture.html?scenario=comment-pages&route=/issue/DEMO-1`. „Weitere Kommentare laden“ ruft `GET /issue/{key}/comment?startAt=…&maxResults=50&orderBy=created` ab, erst nach Klick.
- `window.__qa.commentDetailLimit` begrenzt die Kommentare der Detailantwort (Szenario: 2), `window.__qa.commentPageReads` protokolliert jede Seitenabfrage (`key`, `startAt`, `maxResults`, `orderBy`).
- `window.__qaCommentPagesRule = (key, startAt) => ({ delayMs, status, pageSize, startAt, total, comments })` steuert einzelne Seiten: verzögern, mit HTTP-Status scheitern, kürzere Seiten, abweichend bestätigtes `startAt` (Duplikate), `total: null` (Gesamtzahl unbekannt) oder eine leere Seite.
- Automatisch: `bunx playwright test tests/browser/comment-pages.e2e.ts --workers=1`; mit `COMMENT_PAGES_SHOTS=<Ordner>` zusätzlich Screenshots.

## Link zu einem Kommentar

- `...fixture.html?scenario=comment-links&route=/issue/DEMO-1` zeigt zwei QA-Kommentare mit numerischen IDs (`10001`, `10002`), einer davon mit sehr langem Autorennamen. Jeder Kommentar hat die Aktion „Jira-Link zum Kommentar kopieren“; kopiert wird `https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10001#comment-10001`.
- `window.__qaSiteUrl` (per `addInitScript`) ersetzt die Instanzadresse der simulierten Sitzung, z. B. mit Kontextpfad, leer (keine Verbindung) oder mit Zugangsdaten (wird abgelehnt).
- Automatisch: `bunx playwright test tests/browser/comment-link.e2e.ts --workers=1` prüft die tatsächlichen Bytes der Zwischenablage, einmaliges Kopieren bei Doppelklick, Tastatur, Fehler der Zwischenablage, fehlende oder ungültige Verbindung, unveränderten Entwurf und Sortierung, neu hinzugefügte Kommentare sowie 390 px hell und dunkel mit reduzierter Bewegung. Mit `COMMENT_LINK_SHOTS=<Ordner>` entstehen Screenshots.

## Ticketansicht nach Ladefehlern

`window.__qaIssueRule = (key) => ({ delayMs, status, summary })` steuert ausschließlich den vollständigen Ticketabruf `GET /issue/{key}?fields=*all`: verzögern, mit HTTP-Status scheitern lassen oder eine geänderte Zusammenfassung liefern. Per `addInitScript` gesetzt wirkt die Regel schon auf den ersten Abruf. `window.__qa.issueReads` zählt die Abrufe.

- Erster Fehler ohne Daten: eigene Erklärung je Ursache (503, 403, 404) mit „Erneut versuchen“. 403/404 werden weder als Abmeldung noch als sicher gelöscht bezeichnet.
- Fehlgeschlagene Aktualisierung mit geladenem Ticket („Weitere Ticketaktionen“ → „Aktualisieren“ oder nach einem Schreibzugriff): Inhalt, Kommentare, Kommentarentwurf, Editor-DOM und geöffneter Bereich bleiben; Hinweis mit Datenstand und Retry.
- Sitzung fehlt bzw. ist nicht lesbar: `scenario=calendar-offline` bzw. `scenario=session-error` mit `route=/issue/DEMO-1`.
- Automatisch: `bunx playwright test tests/browser/issue-recovery.e2e.ts --workers=1`; mit `ISSUE_RECOVERY_SHOTS=<Ordner>` zusätzlich Screenshots.

## Ticket-Tabs je Konto

Tabs und Pins liegen weiter unter `betterjira-issue-tabs`, jetzt je Arbeitsbereich `JSON.stringify([cloudId, accountId])`. Die alte globale Liste `{ keys, pinned }` wird beim Laden in Quarantäne gelegt und keinem Konto automatisch zugeordnet. Erst nach bestätigter Sitzung und `/myself` zeigt die Kopfleiste Tabs; vorher schreibt keine Aktion.

- Alte globale Tabs: `fixture.html?scenario=tabs-legacy&route=/` (DEMO-3, DEMO-1 angeheftet, DEMO-2). Übernehmen/Verwerfen über den Hinweis in der Kopfleiste ab 640 px, darunter über „Weitere Aktionen“, oder die Command Palette, jeweils mit „Rückgängig“.
- Anderes Konto oder andere Instanz: `account=<id>` bzw. `cloud=<id>` an die Fixture-URL hängen.
- `window.__qaMyselfRule = () => ({ delayMs, status })` verzögert oder bricht `/myself` ab, `window.__qaIssueRule = (key) => ({ delayMs, status })` die Ticketdetails. Per `addInitScript` setzen.
- `window.__qaMyselfGate` kann eine kontrollierte Promise sein. Die langsame Prüfung bleibt bis zu ihrer expliziten Freigabe stehen; das Prüfen der ungeladenen Ansicht hängt dadurch nicht von einer festen Verzögerung ab.
- `busy` legt die zwölf Tabs bereits im neuen Format für `qa-cloud` / `qa-user` an.
- `issue-tab-scopes.e2e.ts` prüft A → B → A, gleichen Schlüssel in anderer Instanz, langsame und fehlgeschlagene Kontoprüfung, Abmelden, Laden aus fremdem Pfad, Quarantäne mit Rückgängig, Command Palette und 390 px. `ISSUE_TAB_SCOPE_SHOTS=<Ordner>` speichert Screenshots.

Integration offener PRs:

- #37 (Tab-Suche): `useIssueTabStore((state) => state.keys)` und `useIssueTabs()` bleiben erhalten; `keys`/`pinned` im Store sind nur noch die Sicht des bestätigten Kontos.
- #41 (schlanke Titel): in `useIssueTabs` die Zeile `const issues = useQueries(...)` samt `title:` durch `useIssueTabMetadata(ordered, activeKey)` ersetzen. Die passiven Detail-Beobachter und Cache-Leser in diesem Hook müssen dann den bestätigten Scope/QueryClient an `issueQuery` übergeben und `jiraKeys.issueDetail(key, scope)` lesen. `useRememberIssueTab` verwendet `useJiraIssue` aus `hooks/jira/use-jira-issue` und beobachtet dieselben Details, ohne eine zweite Titelabfrage.
- #44 (Ticket-Wiederherstellung): Query-Factory, Scope-Guard und die neuen Query-Hooks sind identisch. Dessen `SessionGate` und Controller mit `useRememberIssueTab` aus diesem PR zusammensetzen; das frühere `onEnter.open` bleibt entfernt.

## Tab-Titel offener Tickets

- Zwölf offene Tabs: `...fixture.html?scenario=busy&route=/issue/DEMO-1`. Nur das aktive Ticket lädt volle Details (`fields=*all`), die übrigen Tabs fragen ausschließlich `GET /issue/{key}?fields=summary` ab, höchstens vier gleichzeitig.
- `window.__qaTabTitleRule = (key) => ({ delayMs, status, summary })` (per `addInitScript`) verzögert, scheitert oder ersetzt den Titel einzelner Abrufe. `window.__qaTabTitles` zählt `calls`, `open` und `peak`.
- Automatisch: `bunx playwright test tests/browser/issue-tab-metadata.e2e.ts --workers=1`; mit `ISSUE_TAB_SHOTS=<Ordner>` zusätzlich Screenshots (prüft vorher, dass Geist geladen ist).

## Geöffnete Tickets durchsuchen

- Nach dem Einstieg aus der Palette kehrt der Fokus beim Schließen zu „Suchen“ zurück. Enter auf „Suche leeren“ leert nur das Feld; es öffnet keinen markierten Tab.

- `...fixture.html?scenario=busy` (12 offene Tabs, `DEMO-2` angeheftet). Bei schmalem Fenster über „Weitere Aktionen“ → „Geöffnete Tickets durchsuchen“, auf dem Desktop über die Command Palette (`Strg K`, „Geöffnete Tickets durchsuchen“).
- Der Dialog filtert nur die bereits geladenen Tabs nach Schlüssel und bekanntem Titel; er lädt nichts aus Jira nach, schließt keine Tabs und ändert keine Pins. Tabs ohne geladenen Titel erscheinen mit „Titel nicht geladen“ und sind über den Schlüssel auffindbar.
- Automatisch: `bunx playwright test tests/browser/open-tab-search.e2e.ts --workers=1` prüft Reihenfolge, aktiven und angehefteten Tab, Suche ohne zusätzliche `GET /issue`-Anfragen, keinen Treffer mit Zurücksetzen, Tastatur und Maus mit erhaltenem Kommentarentwurf, unbekannte Titel, Wiederöffnen, Abmelden, Escape mit Fokusrückgabe sowie 390 px dunkel mit reduzierter Bewegung. Mit `OPEN_TAB_SEARCH_SHOTS=<Ordner>` speichert der Test Screenshots.

## Ticket-Links in der Command Palette

- Fixture öffnen, `Strg`/`⌘` + `K`, einen Link der simulierten Instanz einfügen, z. B. `https://example.atlassian.net/browse/DEMO-2?focusedCommentId=1#comment-1`. Die Palette zeigt nur „DEMO-2 öffnen“ mit der bekannten Ticket-Vorschau; Enter oder Klick öffnet `/issue/DEMO-2` in BetterJira. Es wird keine externe URL geöffnet.
- Akzeptiert werden nur `https`-Links mit exakt der Origin der verbundenen Instanz, ohne Zugangsdaten und mit Pfad `/browse/<SCHLÜSSEL>`. Query und Fragment werden verworfen. Fremde oder täuschende Hosts, andere Protokolle, Zugangsdaten, andere Pfade und fehlende Anmeldung (`scenario=calendar-offline`) werden in der Palette erklärt, ohne Query oder Fragment anzuzeigen.
- Im Link-Modus startet keine Jira-Volltextsuche (`window.__qa.searches` bleibt ohne neuen `text ~`-Eintrag); eine verzögerte frühere Freitextantwort überlagert den Linktreffer nicht.
- Automatisch: `bunx playwright test tests/browser/ticket-reference.e2e.ts --workers=1`; mit `TICKET_REFERENCE_SHOTS=<Ordner>` zusätzlich Screenshots. Parsergrenzen: `src/lib/ticket-reference.test.ts`.

## Anhänge durchsuchen

- `...fixture.html?scenario=attachments&route=/issue/DEMO-1`, dann „Details“ → „Anhänge“: sieben lokale Testanhänge (Bild, PDF, langer Dokumentname, CSV, ZIP, Anhang ohne Namen und MIME-Typ, PDF-Endung mit `application/octet-stream`). `window.__qaAttachments` (per `addInitScript`) ersetzt die Liste.
- Suche und Dateityp-Filter arbeiten nur auf den geladenen Metadaten. `window.__qa.opened` enthält extern geöffnete Anhang-URLs; ein Upload wird lokal simuliert und in `window.__qa.writes` protokolliert.
- Automatisch: `bunx playwright test tests/browser/attachment-filter.e2e.ts --workers=1`; mit `ATTACHMENT_FILTER_SHOTS=<Ordner>` zusätzlich Screenshots.
