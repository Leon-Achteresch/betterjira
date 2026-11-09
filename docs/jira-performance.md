# Jira-Mock für Performance- und Integrationstests

`tests/jira/` enthält ein deterministisches Jira-Cloud-Backend im Speicher. Es spricht dieselben URLs wie der Produktions-Client (`https://api.atlassian.com/ex/jira/<cloudId>/rest/...`). Es erzeugt tausende Issues, paginiert wie Jira, kann langsam, gedrosselt oder fehlerhaft antworten, nimmt Mutationen an und zählt jeden Request.

| Datei | Aufgabe |
| --- | --- |
| `mock-backend.ts` | `createJiraMock()`: `fetch`, `invoke`, Latenz, 429, Fehler, Metriken |
| `tauri-mock.ts` | Ersatz für `@tauri-apps/plugin-http`, `@tauri-apps/api/core` und `@tauri-apps/api/window` |
| `mock-routes.ts` | REST- und Agile-Endpunkte |
| `mock-store.ts` | Jira-Fachlogik: Suche, Felder, Mutationen, fremde Änderungen |
| `mock-data.ts` | Datensatz aus einem Seed |
| `mock-jql.ts` | JQL-Parser und -Auswertung (Teilmenge) |
| `mock-server.ts`, `serve.ts` | Optionaler HTTP-Server |

## In Vitest gegen den echten Client

```ts
import { Effect } from "effect";
import { vi } from "vitest";
import { createJiraMock, LATENCY } from "../jira/mock-backend";
import { useJiraMock } from "../jira/tauri-mock";

vi.mock("@tauri-apps/plugin-http", () => import("../jira/tauri-mock"));
vi.mock("@tauri-apps/api/core", () => import("../jira/tauri-mock"));
vi.mock("@tauri-apps/api/window", () => import("../jira/tauri-mock"));

const mock = useJiraMock(createJiraMock({ issues: 5000, projects: ["PERF"], latency: LATENCY.realistic }));
const { searchIssues } = await import("@/lib/jira/search");
```

Die Pfade in `vi.mock` gelten relativ zur Testdatei. Produktionsmodule erst nach `useJiraMock` per `await import()` laden. `tauri-mock.ts` beantwortet nur `session_get`, `session_set` und `session_delete`. Andere Tauri-Kommandos werfen einen Fehler. Braucht ein Test mehr davon, `invoke` dort selbst mocken und an `mock.invoke` weiterreichen.

Der Client hält Modulzustand, etwa eine gecachte Session und eine Rate-Limit-Sperre. Für unabhängige Szenarien pro Testdatei einen eigenen Mock nutzen, oder `vi.resetModules()` aufrufen und die Module neu importieren.

Ein vollständiges Beispiel steht in `tests/jira/client-wiring.test.ts`.

## Optionen

```ts
createJiraMock({
  seed: 1,                     // gleicher Seed = identische Daten, Jitter und Fehlerfolgen
  issues: 2000,                // verteilt reihum auf die Projekte
  projects: ["PERF", "CORE", "OPS"],
  users: 24,                   // users[0] ist "Mock Me" = currentUser()
  epoch: Date.UTC(2026, 9, 1, 8), // Anker für erzeugte Datumswerte, Standard ist fest
  now: () => Date.now(),       // Uhr für Mutationen, relative JQL (-5m) und Rate-Limit
  latency: LATENCY.realistic,  // none (Standard) | realistic | slow | eigenes Profil
  rateLimit: { requests: 10, perMs: 1000 },
  faults: [{ route: "search", status: 503, times: 2 }],
  pageLimit: 20,               // senkt alle Seiten-Obergrenzen, z. B. für viele Folgeseiten
});
```

Jedes Projekt bekommt ein Scrum-Board (ID `2i+1`, 6 abgeschlossene, 1 aktiver, 2 künftige Sprints) und ein Kanban-Board (ID `2i+2`). Beide Boards nutzen den Filter `10000+i` mit `project = KEY ORDER BY Rank ASC`. Die Felder sind: Sprint `customfield_10020`, Story Points `customfield_10016`, Flagged `customfield_10021`, Rank `customfield_10019`. Rund 12 % der Issues sind Sub-Tasks, rund 8 % sind „Mock Me“ zugewiesen.

## Latenz

Ein Profil ordnet Routennamen (`RouteName`, z. B. `search`, `board-config`, `transition`) oder `default` eine Verzögerung zu: `{ base, jitter, perItem }`.

- `base ± jitter` gilt vor der Verarbeitung.
- `perItem × Anzahl Einträge` gilt danach. Große Seiten werden so spürbar langsamer.

`realistic` ist ein synthetisches Lastprofil: eine Suchseite mit 100 Issues dauert 500–800 ms. Diese Werte sind Annahmen und wurden nicht gegen eine echte Jira-Instanz gemessen. `slow` ist `realistic` mal 4. Für andere Faktoren gibt es `scaleLatency(profile, faktor)`, zur Laufzeit `mock.setLatency(...)`.

Mutationen greifen erst nach der Basislatenz. Ein abgebrochener Request (`AbortSignal`) ändert deshalb nichts und wird als `aborted` gezählt. Der Jitter ist geseedet.

Mit Fake-Timern ist die virtuelle Ladezeit reproduzierbar:

```ts
vi.useFakeTimers();
const start = Date.now();
const loading = Effect.runPromise(loadBoard());
await vi.runAllTimersAsync();
await loading;
expect(Date.now() - start).toBeLessThan(3000);
expect(mock.stats().maxInFlight).toBeLessThanOrEqual(6);
```

## 429 und Fehler

- `rateLimit` ist ein Token-Bucket. Ist er leer, antwortet der Mock sofort mit `429`, `Retry-After` (Sekunden) und `RateLimit-Reason`.
- Fehlerregeln über `faults` oder `mock.addFault(rule)`. Der Aufruf gibt eine Funktion zum Entfernen zurück, `mock.clearFaults()` entfernt alle. Felder einer Regel:
  - `route`, `method`, `match(request)`: welche Requests betroffen sind
  - `status`: HTTP-Code oder `"network"` (dann rejected `fetch` mit `TypeError`)
  - `skip`: die ersten n Treffer durchlassen
  - `times`: höchstens n-mal auslösen
  - `probability`: geseedet, also reproduzierbar
  - `retryAfter`, `body`: Antwort-Header und -Body

## Mutationen und fremde Änderungen

Über HTTP verfügbar:

- Felder bearbeiten (`PUT /issue/{key}`, inkl. `update.labels`)
- Transitionen (`GET`/`POST .../transitions`; „Done“ setzt `resolution`)
- Zuweisung, Kommentare und Worklogs (api/2 und api/3)
- Anhänge (multipart)
- Issue anlegen
- Rang ändern (`PUT /rest/agile/1.0/issue/rank`)
- Filter anlegen, ändern, löschen, favorisieren

Jede Änderung schreibt einen Changelog-Eintrag, setzt `updated` und ist in der nächsten Suche sichtbar.

Direkt im Test:

```ts
mock.simulateChanges(200);                         // fremde Nutzer ändern Status, Bearbeiter, Titel, Priorität, Kommentare
mock.simulateChanges(20, { kinds: ["status"], keys: ["PERF-1"] });
mock.jira.transitionTo("PERF-1", "Done");
mock.jira.editIssue("PERF-2", { fields: { summary: "Neu" } });
mock.jira.findIssue("PERF-3");                     // Rohzustand für Assertions
```

`simulateChanges` setzt `updated = now()`. Polling-JQL wie `updated >= -5m` findet die Änderungen also.

## Metriken

- `mock.stats()` liefert: `total`, `inFlight`, `maxInFlight`, `aborted`, `failed`, `rateLimited`, `items`, `bytes`, `byRoute` und `byStatus`.
- `mock.requests` enthält jeden Request mit `seq`, `route`, `path`, `status`, `startedAt`, `endedAt`, `items`, `bytes` und `fault`.
- `mock.resetStats()` setzt alles zurück.

## Lokaler HTTP-Server

```sh
bun tests/jira/serve.ts --issues 5000 --projects PERF --latency slow --rate-limit 10 --port 8787
curl -H "Authorization: Bearer mock" "http://127.0.0.1:8787/rest/api/3/search/jql?jql=project%20%3D%20PERF&fields=summary"
curl http://127.0.0.1:8787/__mock/stats
curl -X POST "http://127.0.0.1:8787/__mock/changes?count=50"
```

Der Server akzeptiert `/rest/...` und `/ex/jira/mock-cloud/rest/...`, setzt CORS-Header und bricht bei `"network"`-Fehlern die Verbindung ab. In Tests: `const server = await serveJiraMock(mock)` (freier Port), danach `server.close()`.

## Jira-Verhalten, das der Mock nachbildet

- `/search/jql` paginiert nur über `nextPageToken`. Die Folgeseiten lassen sich deshalb nicht parallel laden. Die Agile-Endpunkte (`/board/{id}/issue`, `/board/{id}/backlog`, `/sprint/{id}/issue`) liefern dagegen `startAt` und `total`, dort sind parallele Seiten möglich.
- Seiten-Obergrenzen:
  - Suche: 100 mit Feldern, 5000 nur mit `id`/`key`
  - Agile-Issues: 100
  - Boards, Sprints, Projekte: 50
  - Changelog: 100
- Ohne `fields` liefert `/search/jql` nur `id` und `key`.
- Tokens gelten nur für dieselbe JQL. Ungültige Tokens und JQL ohne Einschränkung („Unbounded JQL“) ergeben `400`.
- `!=` und `NOT IN` schließen leere Werte aus. `sprint not in openSprints()` trifft also keine Issues ohne Sprint.
- Unbekannte Felder, Funktionen und Sortierungen ergeben `400` mit einer Jira-ähnlichen `errorMessages`-Meldung. `/jql/parse` liefert dieselben Fehler.
- `expand=changelog`: höchstens 100 Einträge, neueste zuerst. Das entspricht der Annahme in `enteredColumn`. `/issue/{key}/changelog` liefert die älteste Änderung zuerst.

## Grenzen

- JQL ist eine Teilmenge. Unterstützt werden:
  - Felder: `project`, `key`, `status`, `statusCategory`, `assignee`, `reporter`, `watcher`, `type`, `priority`, `labels`, `sprint`, `resolution`, `parent`, Datumsfelder, `summary`/`description`/`text ~`, `worklogAuthor`, `worklogDate`, `filter`, Story Points
  - Funktionen: `currentUser()`, `openSprints()`, `closedSprints()`, `futureSprints()`, `now()`, `startOfDay()`, `endOfDay()`
  - Nicht unterstützt: `was`, `changed`, `component`, `fixVersion`
- Nicht nachgebildet sind OAuth und Token-Refresh, `createmeta` und `mypermissions`, Bild- und Avatar-Downloads (Avatar-URLs zeigen nicht auf `/rest/api/3`), Remote-Links mit Inhalt, Sprint-Verschiebungen und Issue-Löschen. Unbekannte Routen antworten mit `404 Mock: … is not implemented`.
- Datumswerte sind UTC. Die Zeitzone des Nutzers spielt keine Rolle.

## Optimierter Produktionspfad

- `src/lib/jira/board-query.ts` lädt Konfiguration und Feldkatalog parallel über gemeinsame TanStack-Query-Keys. Konfiguration bleibt 10 Minuten frisch, der Feldkatalog eine Stunde. Backlog und Board teilen die Konfiguration.
- `useJiraBoard` zeigt zunächst 100 Tickets. Beim Scrollen zum Listenende werden weitere Cursor-Seiten geladen; der Button erlaubt dasselbe per Tastatur. Keine stille Begrenzung auf die ersten 100 Tickets. Filter und Insights weisen bei unvollständig geladenen Boards auf ihren Umfang hin.
- Tickets bleiben eine Minute frisch und bis zu 30 Minuten im Cache. Navigation kann den Cache sofort anzeigen. Fehlgeschlagene Folgeseiten verdrängen die bereits geladenen Karten nicht.
- Der Transport begrenzt Jira auf sechs gleichzeitige Lese- und zwei Schreibzugriffe. Ein voller Lese-Pool blockiert dadurch keine Schreibaktion. Session-Daten werden im Speicher wiederverwendet, statt für jeden Request erneut auf den Schlüsselbund zuzugreifen.
- Sichere Lesezugriffe wiederholen 429/502/503/504 höchstens zweimal mit Backoff und Jitter. `Retry-After` gilt als gemeinsame, abbrechbare Pause. Bei Wartezeiten über fünf Sekunden zeigt die App den Fehler mit dem frühesten Zeitpunkt sofort; neue Requests respektieren die Sperre weiter. Schreibzugriffe werden nicht automatisch wiederholt. Identische noch laufende Kommentare, Worklogs, Feldänderungen und Transitionen werden zusammengeführt.
- Titel, Labels, Fälligkeit und Status werden im Board optimistisch aktualisiert. Fehler setzen nur betroffene Felder zurück. Neuere lokale Änderungen und Änderungen an anderen Tickets bleiben erhalten.
- Erfolgreiche Änderungen werden 150 ms gesammelt und pro aktivem Board bzw. aktiver Suche in Gruppen bis zu 50 Tickets abgeglichen. Der Abgleich prüft die bestehende JQL samt Sprint, lädt alle nötigen Folgeseiten und aktualisiert die vorhandenen Cache-Seiten. Er spielt nicht sämtliche geladenen Seiten erneut ab. Inaktive Ansichten werden für den nächsten Besuch als veraltet markiert. Erfolgreich abgeglichene aktive Boards bleiben frisch, damit der nächste Fensterfokus nicht sofort sämtliche Cursor-Seiten erneut lädt. Ein vollständiger Abgleich nach Ablauf der Frischezeit bleibt für fremde Änderungen, entfernte Tickets und die globale Sortierung vorgesehen.
- Ticketzähler und die Daten der Command Palette werden ebenfalls einmal je gesammelter Änderungsgruppe aktualisiert. Bereits laufende Aktualisierungen werden dafür nicht abgebrochen und neu gestartet.
- Für bekannte numerische Issue-IDs setzt der Abgleich `reconcileIssues`, damit der Suchindex nach einer eigenen Änderung keinen älteren Stand zurückliefert. Grundlage ist [Atlassians Search-and-Reconcile-Vertrag](https://developer.atlassian.com/cloud/jira/platform/search-and-reconcile/).
- Kommentare, Anhänge und Worklogs aktualisieren die Ticketdetails, ohne sämtliche Boards zu invalidieren.
- Optionale Tab-Titel verzichten zusätzlich zu Query-Retries auch auf Transport-Retries (`retry: false` am Client). Fehlende Titel bleiben beim Schlüssel, ohne Hintergrundanfragen zu vervielfachen.
- Suchfelder werden für den Query-Key dedupliziert und sortiert. Eine reine Änderung der Spaltenreihenfolge löst keine neue Suche aus. Wiederholte Seitentokens werden gestoppt.

Die sofortige Zusammenführung hält bestehende Positionen bei und fügt neu passende Tickets auf der ersten geladenen Seite an. Eine vollständige Aktualisierung stellt die globale Sortierung wieder her. Cursor-Seiten sind bei Jira voneinander abhängig; ein komplett geladenes Board mit tausenden Tickets dauert weiterhin länger als seine erste sichtbare Seite. Changelogs bleiben für „Tage in Spalte“ enthalten und können einen großen Teil der Nutzlast ausmachen. Ihre Vollständigkeit ist durch Jiras eingebettetes Changelog begrenzt.

## Reproduzierbare Prüfungen

```sh
bun run test:jira
bun run test
bun run build
E2E_BROWSER_CHANNEL=chromium bun run test:e2e tests/browser/board-performance.e2e.ts tests/browser/issue-query-states.e2e.ts --workers=1
bun run mock:jira --issues 5000 --projects PERF --latency slow
```

`E2E_BROWSER_CHANNEL` kann den voreingestellten Edge-Browser ersetzen. `E2E_PORT` erlaubt einen separaten Testserver, wenn bereits eine andere Entwicklungssitzung läuft.

`tests/jira/board-integration.test.ts` führt die echten Board-Queries und den echten Tauri/Effect-Transport gegen das langsame Backend aus. Das feste Profil enthält 300 ms für Konfiguration, 400 ms für Felder und 800 ms je Suchseite. Die erste Seite endet im Test nach genau 1.200 ms virtueller Zeit; ein erneuter Abruf im frischen Cache sendet keinen Request. Das ist eine deterministische API-Messung, keine Browser- oder Produktionsmessung.

Weitere geprüfte Budgets: 5.000 unterschiedliche Tickets über 50 Seiten mit einmaliger Konfiguration und Feldabfrage; zehn schnelle Änderungen mit einer gefilterten Board-Abfrage und zehn zurückgegebenen Tickets; erhaltene Seiten bei Fehler und Retry; 429 mit `Retry-After`; Request-Abbruch; Schutz vor veralteten Antworten; Rollback paralleler Felder; Deduplizierung von Schreibzugriffen. Der Browser-Test lädt 350 Tickets in vier Seiten und prüft die Metadaten-Requests auf Desktop sowie schmal, dunkel und mit reduzierter Bewegung.
