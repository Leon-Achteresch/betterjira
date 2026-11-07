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
