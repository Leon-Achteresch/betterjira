# Projektrichtlinien

## Animationen (Motion)

Die gesamte UI soll sich lebendig und hochwertig anfühlen: Setze überall viele, aber nie übertriebene Animationen mit `motion` (`motion/react`) ein.

- Jede sichtbare Zustandsänderung bekommt eine Animation: Ein-/Ausblenden (`AnimatePresence`), Listen-Einträge, Wechsel von Inhalten, Hover-/Press-Feedback, Layout-Verschiebungen (`layout`, `layoutId`), Overlays, Tabs und Indikatoren.
- Subtil statt spektakulär: kleine Distanzen (4–12 px), leichte Skalierung (0.96–1), Opacity-Fades. Kein Wackeln, kein starkes Überschwingen, keine Dauerschleifen-Animationen ohne Zweck.
- Kurz und reaktionsschnell: Mikro-Interaktionen 120–200 ms, Panels/Overlays 200–350 ms. Exit-Animationen kürzer als Entry. Nichts darf Eingaben blockieren oder die App träge wirken lassen.
- Nur `transform` und `opacity` animieren, keine layout-auslösenden Properties wie `width`, `height`, `top` (dafür `layout` nutzen).
- Easings und Springs ausschließlich aus `src/lib/ease.ts` verwenden (`EASE_OUT`, `SPRING_PRESS`, `SPRING_PANEL`, `SPRING_LAYOUT` usw.), keine Ad-hoc-Werte. Fehlt ein passender Preset, dort ergänzen.
- Vorhandene Bausteine aus `src/components/motion/` wiederverwenden, bevor neue Animationen gebaut werden.
- Listen gestaffelt einblenden (`staggerChildren` ca. 20–40 ms), aber nur beim ersten Erscheinen, nicht bei jedem Re-Render.
- `prefers-reduced-motion` immer respektieren (`useReducedMotion`): dann nur Fades oder gar keine Bewegung.

## Frontend-Architektur (CleanCode)

Gilt für neuen Code und für Dateien, die ohnehin angefasst werden. Bestehende Abweichungen, etwa Hooks in `src/lib/`, ziehen beim Anfassen um, nicht in einem Schwung.

### Struktur

- `src/components/ui/`: generische Primitive (shadcn/base-ui), ohne Fachbegriffe.
- `src/components/motion/`: generische Animationsbausteine, ohne Fachlogik.
- `src/components/<bereich>/` (z. B. `shell/`, Issue-Komponenten): Fachkomposition aus generischen Bausteinen. Kein Datenabruf, keine Berechnungen.
- `src/hooks/`: alle React-Hooks, inklusive Query-/Mutation-Hooks und Zustand-Stores. Bei vielen Hooks Unterordner je Bereich, z. B. `src/hooks/jira/`.
- `src/lib/`: alles ohne React (API-Clients, Schemas, Mapper, Formatierung, Konstanten). Nur `.ts`, kein JSX, keine Hooks.
- `src/routes/`: nur zusammensetzen. Hooks aufrufen, Props an Komponenten reichen, keine eigene Logik.

### Komponenten

- Immer generisch über Props: Daten, Texte, Callbacks und Varianten kommen von außen. Generische Komponenten kennen keine Fachbegriffe wie Issue, Projekt oder Jira.
- Eine Komponente, eine Aufgabe. Mischt eine Datei Datenabruf, Zustandslogik und Darstellung, wird getrennt: Logik in einen Hook, Darstellung in die Komponente.
- Keine Komponenten in anderen Komponenten definieren, sonst werden sie bei jedem Render neu gemountet.
- Varianten über `class-variance-authority` wie in `ui/`, nicht über kopierte Komponenten.
- Vor einer neuen Komponente prüfen, ob `ui/`, `motion/` oder ein bestehender Hook schon passt.

### Hooks und lib

- Ein Hook, eine Verantwortung. Name beginnt mit `use`, Datei in kebab-case (`use-issue.ts`).
- Wiederverwendbare Logik (Zustand, Ableitungen, Handler) gehört in einen Hook, nicht in die Komponente.
- `lib/` ist React-frei: Funktionen bekommen Werte und geben Werte zurück, sind also ohne Rendern testbar.
- Geteilte Konstanten in `lib/`, in `SCREAMING_SNAKE_CASE` (z. B. `EASE_OUT`). Lokale Konstanten bleiben in ihrer Datei.
- Keine neuen Sammeldateien wie `utils.ts`. Dateien nach Verantwortung benennen.
- Ein Muster, das zum zweiten Mal auftaucht, wird nach `lib/`, `hooks/` oder in eine generische Komponente gezogen. Nicht auf Vorrat.

### APIs und Effects

- Jeder API-Zugriff läuft über den Client in `lib/<dienst>/` (z. B. `lib/jira/client.ts`). Komponenten und Hooks rufen nie `fetch` oder Tauri-`invoke` direkt auf.
- API-Aufrufe sind Effect-Programme (`effect`): `Effect.tryPromise` für Netzwerk und Tauri, `Schema` validiert jede Antwort, Fehler sind getaggte Klassen (`Data.TaggedError`).
- Typen aus Schemas ableiten (`typeof X.Type`), nicht doppelt definieren.
- React bindet Effects über TanStack Query an: Lesen mit `useQuery`, Schreiben mit `useMutation`. Die Query-Funktion reicht den Abbruch durch: `queryFn: ({ signal }) => Effect.runPromise(jira("/myself", Myself), { signal })`.
- `Effect.runPromise` nie in Komponenten, sondern in Query- und Mutation-Funktionen.
- Query-Keys nur über eine Key-Factory (`jiraKeys`). Mutationen invalidieren die betroffenen Keys in `onSuccess`.
- Datenabrufe nie per `useEffect` und `useState`, das übernimmt die Query.
- `useEffect` nur, um mit einem externen System zu synchronisieren: DOM, Fenster, Tauri-Events, Timer, Badges. Schreibende Aktionen laufen aus Event-Handlern (`onClick` → `mutate`), nicht aus Effects.

### Allgemein

- Keine Kommentare im Code, außer ausdrücklich gewünscht. Gute Namen und kleine Funktionen erklären den Code.
- Kein `any`. Fremde Daten laufen über `unknown` und ein Schema, nicht über Type-Casts.
