# Mitmachen

Danke, dass du betterjira verbessern willst.

## Ablauf

1. Für größere Änderungen zuerst ein Issue öffnen und kurz abstimmen.
2. Von `development` abzweigen: `git switch -c feat/kurze-beschreibung development`.
3. Änderung umsetzen, `bun run build` und `bun run test` müssen grün sein.
4. Pull Request gegen `development` öffnen. `main` wird nur aus `development` gemergt und löst dort automatisch ein Release aus.

## Commits

Commit-Messages folgen [Conventional Commits](https://www.conventionalcommits.org/de/). Daraus entstehen Version und CHANGELOG automatisch:

| Präfix | Wirkung |
| --- | --- |
| `feat:` | neue Minor-Version |
| `fix:`, `perf:` | neue Patch-Version |
| `feat!:` oder `BREAKING CHANGE:` | neue Major-Version |
| `docs:`, `chore:`, `ci:`, `refactor:`, `test:`, `style:` | kein Release |

Beispiel: `feat(board): Swimlanes nach Bearbeiter`.

## Code

- Regeln für Struktur, Hooks, API-Zugriffe und Animationen stehen in [AGENTS.md](AGENTS.md), Designregeln in [DESIGN.md](DESIGN.md).
- Keine Kommentare im Code, kein `any`.
- Rust-Code in `src-tauri/` mit `cargo fmt` formatieren.

## Fehler melden

Bugs und Wünsche bitte über die Issue-Vorlagen. Sicherheitslücken nicht öffentlich melden, siehe [SECURITY.md](SECURITY.md).
