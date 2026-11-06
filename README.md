<img src="public/logo.svg" alt="betterjira logo" width="96" />

# betterjira

Ein schneller Desktop-Client für Jira Cloud, gebaut mit Tauri, React und TypeScript. Tickets, Boards, Benachrichtigungen, Code-Hosting-Verknüpfungen und Auswertungen in einer nativen App für macOS, Windows und Linux.

## Installation

Fertige Installer gibt es unter [Releases](https://github.com/Leon-Achteresch/betterjira/releases/latest). Die App aktualisiert sich danach selbst.

## Entwicklung

Voraussetzungen: [Bun](https://bun.sh), [Rust](https://rustup.rs) und die [Tauri-Systemabhängigkeiten](https://v2.tauri.app/start/prerequisites/).

```sh
bun install
cp .env.example .env.local   # Atlassian-OAuth-Client eintragen
bun run tauri dev
```

| Befehl | Zweck |
| --- | --- |
| `bun run tauri dev` | App mit Hot Reload starten |
| `bun run build` | Typen prüfen und Frontend bauen |
| `bun run test` | Unit-Tests (Vitest) |
| `bun run tauri build` | Installer für das eigene System bauen |

Empfohlene IDE: VS Code mit den Erweiterungen [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) und [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Mitmachen

Siehe [CONTRIBUTING.md](CONTRIBUTING.md). Architektur- und Animationsregeln stehen in [AGENTS.md](AGENTS.md), Designregeln in [DESIGN.md](DESIGN.md).

## Lizenz

[MIT](LICENSE)
