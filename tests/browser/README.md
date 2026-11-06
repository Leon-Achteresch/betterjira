# Browser-Prüfung ohne Jira-Konto

`bun run dev` starten und `http://localhost:1420/tests/browser/fixture.html` öffnen. Die Seite lädt die echte App mit drei lokalen Testtickets und einer simulierten Tauri-Bridge. Alle Jira-Anfragen bleiben in dieser Simulation. Die Daten sind ausdrücklich Testdaten; sie landen nicht in einem echten Jira.

Für die Tabelle: `http://localhost:1420/tests/browser/fixture.html?route=/bereiche/DEMO`.

Zum Neuladen immer die Fixture-URL öffnen. Die App ersetzt anschließend die Adresse durch ihre normale Route. Ein direktes Neuladen dieser normalen Route lädt die App ohne Tauri-Simulation. Auch ein vollständiger Vite-Neustart durch HMR kann deshalb ein erneutes Öffnen der Fixture erfordern.

## Automatische Prüfung

```sh
bun run test
bun run build
```

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


## UX-Szenarien

- Board mit 64 Tickets, sechs Spalten und Insights: `http://localhost:1420/tests/browser/fixture.html?scenario=board&route=/bereiche/DEMO?board=1`. Geprüft am 06.11.2026: Insights öffnen und schließen, Messgröße/Gruppierung/Segment wechseln, Story-Point-Summe, Zeilenklick filtert das Board, Anzeige-Eigenschaften ein- und ausblenden, Ticket über das Status-Icon verschieben (Zahlen im Panel ziehen mit), hell/dunkel, 390 px, reduzierte Bewegung.

- Viele parallele Arbeitskontexte und langes Ticket: `http://localhost:1420/tests/browser/fixture.html?scenario=busy` (35 vorbereitete Kontexte).
- KI mit acht Vorschlägen und simuliertem Rückkanal: `http://localhost:1420/tests/browser/fixture.html?scenario=ai&route=/`.
- Reduzierte JS-Bewegung: `http://localhost:1420/tests/browser/fixture.html?scenario=busy&reduce=1`.

`window.__qa.briefingFailure = true` simuliert einen fehlgeschlagenen KI-Start. Erfolgreiche Starts liefern nach einer Sekunde ein neues, lokal erzeugtes Testbriefing über das simulierte Tauri-Ereignis. Es wird kein echter Agent gestartet. Ein aktiver Scheduler kann in diesem Szenario schon beim Öffnen einen Lauf beginnen.

Der vollständige Ablaufbericht einschließlich Vielnutzer, sorgfältigem Leser, Unterbrechungen und KI liegt in [docs/ux-arbeitsalltag.md](../../docs/ux-arbeitsalltag.md).

## Kommentare, Antworten und Erwähnungen

Öffnen: `http://localhost:1420/tests/browser/fixture.html?route=/issue/DEMO-1`. DEMO-1 hat elf Kommentare: Lea Musters Rückfrage mit zwei Antworten (`parentId` einmal als Zahl, einmal als Zeichenkette), eine verwaiste Antwort mit `parentId` 99999, einen Kommentar des App-Kontos „Automation für Jira“, einen eigenen Kommentar mit einer Liste, die mit Code beginnt (nicht bearbeitbar), einen eigenen Thread-Anfang mit `visibility` „Developers“, einen von Lea Muster bearbeiteten Kommentar und einen Kommentar mit Links auf Kommentar 20012 in DEMO-2, auf DEMO-3 und auf eine externe Seite. Melder ist die deaktivierte „Ehemalige Kollegin“. Die Fixture liefert die Kommentarliste in Seiten zu je zwei Einträgen.

Testschalter in der Browserkonsole:

```js
window.__qa.commentPageSize = 2;
window.__qa.readDelayMs = 1500;
window.__qa.failCommentList = true;
window.__qa.failUserSearch = true;
window.__qa.rejectParentId = true;
window.__qa.ignoreParentId = true;
window.__qa.ownPermissionsOnly = true;
```

`commentPageSize` begrenzt die Einträge je Seite von `GET /comment`. `readDelayMs` verzögert `GET /comment`. `failCommentList` lässt `GET /comment` mit HTTP 503 scheitern, solange der Schalter an ist. `failUserSearch` lässt `GET /user/viewissue/search` scheitern. `rejectParentId` beantwortet ein `POST /comment` mit `parentId` mit HTTP 400. `ignoreParentId` legt die Antwort ohne `parentId` an, wie ein Jira, das das Feld still verwirft. Projekt vom Typ `service_desk`: `http://localhost:1420/tests/browser/fixture.html?scenario=jsm&route=/issue/DEMO-1`.

`ownPermissionsOnly` liefert bei `GET /mypermissions` nur `EDIT_OWN_COMMENTS` und `DELETE_OWN_COMMENTS`. Weil die App die Rechte je Ticket zwischenspeichert, am einfachsten mit `&permissions=own` in der Fixture-URL starten. `PUT` und `DELETE` auf `/issue/{key}/comment/{id}` ändern die Testdaten und stehen in `writes`; `failNextWrite` und `delayMs` gelten auch für sie.

Alten Textentwurf vorbereiten: Fixture einmal öffnen, dann `http://localhost:1420/logo.svg` öffnen und das Snippet dort in der Konsole ausführen, denn die laufende Fixture überschreibt den Eintrag beim Verlassen. Danach die Fixture neu öffnen:

```js
const stored = JSON.parse(localStorage.getItem("betterjira-workspaces"));
stored.state.workspaces[JSON.stringify(["qa-cloud", "qa-user"])].drafts = { "DEMO-2": "*Stand*\nZweite Zeile" };
localStorage.setItem("betterjira-workspaces", JSON.stringify(stored));
```

Prüfliste:

- [ ] Bei „Älteste zuerst“ und bei „Neueste zuerst“ steht die Kommentar-Box über der Liste; der Umschalter ordnet die Threads um.
- [ ] Der Titel zeigt „Kommentare · 11“, alle elf Kommentare sind sichtbar, obwohl jede Seite nur zwei liefert.
- [ ] `readDelayMs = 1500` setzen und in der App ein noch nicht geöffnetes Ticket (DEMO-3) öffnen: ein Skeleton steht an der Stelle der Liste, in die Box lässt sich tippen.
- [ ] Mit `failCommentList = true` erscheint die Fehlermeldung mit „Erneut laden“; nach `failCommentList = false` lädt „Erneut laden“ die Liste.
- [ ] Lea Musters Rückfrage zeigt beide Antworten eingerückt in aufsteigender Zeit, in beiden Sortierungen, ohne Zuklappen.
- [ ] Die verwaiste Antwort steht als eigener Thread-Anfang.
- [ ] „Antworten“ an Leas Kommentar öffnet die Box am Ende des Threads mit Fokus und dem Inhalt „@Lea Muster “.
- [ ] „Antworten“ am eigenen Kommentar von Alex Beispiel öffnet die Box ohne Vorbelegung.
- [ ] In Box A tippen, dann an einem anderen Thread „Antworten“: Box A schließt, ihr Thread zeigt an jedem Kommentar „Antwort fortsetzen“, beim Zurückkehren ist der Text da.
- [ ] Antwort in Leas Thread senden: `window.__qa.writes.at(-1).input` hat `parentId` 10002 und `body.type` „doc“, die Meldung lautet „Antwort hinzugefügt“, die Box schließt, die Antwort erscheint unter dem Thread, der Titel zeigt 12.
- [ ] Mit `ignoreParentId = true` meldet die App nach dem Senden, dass Jira die Antwort als normalen Kommentar angelegt hat; der Kommentar steht als neuer Thread.
- [ ] Mit `rejectParentId = true` steht die Fehlermeldung in der Antwortbox, der Text bleibt.
- [ ] Antwort auf die verwaiste Antwort sendet `parentId` 99999.
- [ ] Escape (ohne offene Vorschlagsliste) und „Abbrechen“ schließen die Box und behalten den Entwurf; nach erneutem Öffnen der Fixture stehen „Antwort fortsetzen“ und der Text noch da, und die Arbeitsliste zeigt DEMO-1 unter „Angefangen“.
- [ ] Im Szenario `jsm` gibt es keine Aktion „Antworten“.
- [ ] `@` in der Kommentar-Box öffnet die Liste am Cursor, der Fokus bleibt im Editor; angeboten werden Alex Beispiel und Lea Muster, nicht „Automation für Jira“ und nicht „Ehemalige Kollegin“.
- [ ] `@ki` zeigt nach etwa 200 ms „Kim Extern“, höchstens acht Einträge, je Avatar und Name, keine E-Mail-Adresse.
- [ ] Pfeil hoch und runter bewegen die Markierung; in den DevTools trägt der Editor `aria-activedescendant` mit der `id` der markierten `option`, die Liste hat `role="listbox"`.
- [ ] Enter und Tab fügen die markierte Person ein; Escape schließt nur die Liste, die Antwortbox bleibt offen.
- [ ] Nach der Auswahl steht „@Kim Extern “ im Editor; der gesendete Body enthält `{"type":"mention","attrs":{"id":"qa-kim","text":"@Kim Extern"}}` ohne weitere Attribute.
- [ ] Mit `failUserSearch = true` zeigt `@le` Lea Muster und „Suche gerade nicht möglich“; nach `failUserSearch = false` zeigt `@zzz` „Keine Person gefunden“.
- [ ] ⌘ + Enter (macOS) oder Strg + Enter sendet ohne offene Liste; bei offener Liste fügt es die Person ein und sendet nicht.
- [ ] Nur Leerzeichen: „Kommentieren“ ist gesperrt und das Kürzel sendet nicht; nur eine Erwähnung: Senden ist möglich.
- [ ] Die Formatierleiste erscheint nur in der aufgeklappten Box; der Hinweis nennt „@ erwähnt eine Person“ und das Sende-Kürzel.
- [ ] „Vorlage › Statusupdate“ hängt fettes „Stand“ und eine Aufzählung ans Ende des vorhandenen Texts; „Gespeichert“ ist sichtbar; Verwerfen und „Rückgängig“ stellen den Text wieder her.
- [ ] Mit `delayMs = 1500` senden und sofort weitertippen: nach dem Erfolg bleibt der neue Text als Entwurf.
- [ ] Der vorbereitete alte Textentwurf erscheint in DEMO-2 als zwei Absätze mit unverändertem Text, und DEMO-2 steht unter „Angefangen“.
- [ ] Mit gespeichertem Entwurf die Fixture neu öffnen und sofort tippen: der Text erweitert den Entwurf, nichts wird überschrieben.
- [ ] Bei offener Vorschlagsliste die Seite scrollen: die Liste bleibt am Cursor; im Status-Dialog und in Rich-Text-Feldern öffnet `@` keine Liste.
- [ ] Antwortbox, Vorschlagsliste, neue Kommentare und die Markierung bewegen sich hell und dunkel mit Popover-Fläche, Schatten und Haarlinie; mit `&reduce=1` wird nur ein- und ausgeblendet.

## Kommentare bearbeiten, löschen und verlinken

Öffnen: `http://localhost:1420/tests/browser/fixture.html?route=/issue/DEMO-1`.

- [ ] Ab 640 px Breite erscheint der Button „Weitere Aktionen“ nur bei Hover, Fokus im Kommentar oder offenem Menü; schmaler ist er immer sichtbar.
- [ ] Das Menü zeigt „Link kopieren“, „Bearbeiten“, Trennlinie und rotes „Löschen…“; „Link kopieren“ meldet „Link kopiert“, die Zwischenablage enthält `https://example.atlassian.net/browse/DEMO-1?focusedCommentId=<id>`.
- [ ] Kommentar 10008: „Bearbeiten“ ist deaktiviert und nennt „Enthält Inhalte, die sich nur in Jira bearbeiten lassen“.
- [ ] Kommentar 10010 zeigt „bearbeitet“; der Tooltip lautet „Bearbeitet am 05.11.2026, … von Lea Muster“.
- [ ] Mit `&permissions=own` in der Fixture-URL fehlen an Leas Kommentaren „Bearbeiten“ und „Löschen…“, „Link kopieren“ bleibt; an eigenen Kommentaren sind beide da. Im Szenario `jsm` fehlt „Bearbeiten“, „Löschen…“ bleibt.
- [ ] „Bearbeiten“ ersetzt Text und Aktionen durch den Editor mit Formatierleiste, Fokus am Ende; `@` schlägt Personen vor; „Speichern“ ist gesperrt, solange nichts geändert ist.
- [ ] Kommentar 10009 ändern und speichern: „Kommentar gespeichert“, `window.__qa.writes.at(-1)` ist `PUT` mit `input.visibility` `{ type: "role", value: "Developers", identifier: "Developers" }`; Antwort 10003 speichern: kein `visibility`, kein `parentId`; danach steht „bearbeitet“ am Kommentar.
- [ ] Ändern und Escape drücken: Editor schließt, „Entwurf“ steht neben der Zeit, das Menü heißt „Bearbeitung fortsetzen“, DEMO-1 steht in der Arbeitsliste unter „Angefangen“; „Änderungen verwerfen“ setzt den Text zurück und der Knopf „Entwurf“ verschwindet.
- [ ] Mit `delayMs = 1500` speichern und sofort weitertippen: Editor schließt nach dem Erfolg, „Entwurf“ steht am Kommentar, „Bearbeitung fortsetzen“ zeigt den neueren Text.
- [ ] Mit `failNextWrite = true` speichern: Fehlermeldung im Editor, Inhalt bleibt. Mit `delayMs = 1500` und `failNextWrite = true` speichern und sofort einen anderen Kommentar bearbeiten: Toast „Kommentar konnte nicht gespeichert werden“, im zweiten Editor kein Fehler.
- [ ] Leas Rückfrage 10002 löschen: Dialog „Kommentar löschen?“ nennt „Das lässt sich nicht rückgängig machen. Die 2 Antworten bleiben erhalten und stehen danach als eigener Thread.“; nach „Löschen“ meldet die App „Kommentar gelöscht“ und 10003 und 10005 stehen als eigener Thread.
- [ ] Mit `delayMs = 1500` „Löschen“ bestätigen und sofort Escape drücken: der Dialog bleibt offen, „Löschen“ ist gesperrt, bis die Antwort kommt. Mit `failNextWrite = true` löschen: Dialog schließt, Toast „Kommentar konnte nicht gelöscht werden“ mit der Meldung „Test: Jira vorübergehend nicht erreichbar“.
- [ ] Fixture neu öffnen, `failCommentList = true` setzen und in Kommentar 10011 „die Abstimmung in DEMO-2“ anklicken: DEMO-2 öffnet, keine Meldung „Kommentar nicht mehr vorhanden“, keine Meldung „An letzter Lesestelle fortgesetzt“, `comment` bleibt in der URL; nach `failCommentList = false` und „Erneut laden“ springt die Ansicht zu 20012.
- [ ] Zurück in DEMO-1 „die Abstimmung in DEMO-2“ anklicken: DEMO-2 öffnet in der App, Kommentar 20012 steht mittig und ist etwa 2 Sekunden hinterlegt; Text und Menü bleiben lesbar und klickbar; die Seite springt danach nicht nach oben; die URL trägt kein `comment` mehr; keine Meldung „An letzter Lesestelle fortgesetzt“. Mit `&reduce=1` springt die Ansicht ohne Scroll-Animation.
- [ ] In 10011 die Karte auf DEMO-3 öffnet DEMO-3 in der App; „die Doku“ öffnet im Browser. Strg-Klick (macOS: ⌘-Klick) auf die Karte öffnet DEMO-3 als Hintergrund-Tab, DEMO-1 bleibt offen.
- [ ] In DEMO-2 Kommentar 20012 löschen, zurück in DEMO-1 „die Abstimmung in DEMO-2“ anklicken: nach einem Neuladen der Liste meldet die App „Kommentar nicht mehr vorhanden“, `comment` verschwindet aus der URL.
- [ ] Nur in FSI-38, weil die Fixture keine fremden neuen Kommentare erzeugt: eine Benachrichtigung über einen Kommentar öffnen (Zeile, Gruppenzeile oder Toast „Öffnen“): das Ticket öffnet und springt zu diesem Kommentar.
