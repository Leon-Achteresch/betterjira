# N16-Quellmail-CC über macOS-Tauri-IPC

Führe den Lauf im Repository-Root mit reserviertem macOS-Prüfplatz aus.

```sh
work=$(mktemp -d /tmp/betterjira-n16.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
for scenario in n16 n17 c1; do
  node_modules/.bin/vite build --config "tests/native/$scenario-tauri/vite.config.ts" --outDir "$work/$scenario"
  python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/$scenario" "$scenario"
done
```

N16 verwendet den regulären Zammad-Verlauf und Antworteditor im privaten WKWebView. Die Originalbefehle für Verbindung und Anfragen senden über den nativen Client. Die aus N17 übernommene Test-CA gilt für den dynamischen HTTPS-Port auf `127.0.0.1`. Vor dem Start prüft Seatbelt beide erlaubten Fixture-Ports sowie einen gesperrten Netzwerkport und eine gesperrte Datei. Temporäre App- und WebView-Daten werden beim Ende verworfen. Der Host prüft und entfernt die synthetische Zammad-Verbindung und Jira-Sitzung über IPC.

Das Ledger protokolliert Methode, Pfad und synthetisches Konto für jede native Zammad-Anfrage. N16 erwartet null Zammad-Schreibrequests. Der Lauf prüft die bewusste Auswahl aus gültigen CCs, zwei bereits vorhandene Empfänger, einen absichtlich abgewählten CC, Abbruch, fehlende und fehlerhafte Werte sowie eine 403-Antwort. Drei gehaltene GETs prüfen die Erstauflösung von `/users/me` mit bereits erfasstem Entwurf sowie verspätete Quellantworten nach Ticket- und Kontowechsel.

N17 und C1 verwenden getrennte Läufe mit jeweils einer ausdrücklich ausgelösten synthetischen Mutation. Die N17-Kontrolle prüft den Entwurferhalt innerhalb einer Revision und die Trennung bei einer neuen Revision. Geprüft werden DOM-Interaktionen im privaten Host und der tatsächliche lokale Transport. Signiertes Packaging, System-Accessibility und die Rechte und Metadaten einer Live-Instanz benötigen eigene Nachweise.
