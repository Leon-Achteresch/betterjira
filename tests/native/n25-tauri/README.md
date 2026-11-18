# N10-Duplikatvergleich und N25-Richtungsvorschau über macOS-Tauri-IPC

Im Repository-Root mit reserviertem macOS-Prüfplatz ausführen.

```sh
work=$(mktemp -d /tmp/betterjira-n25.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n25-tauri/vite.config.ts --outDir "$work/n25"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/n25" n25
```

Jeder N25-Lauf startet einen privaten WKWebView und einen dynamischen HTTPS-Listener auf `127.0.0.1`. Der C1-Runner erzeugt mit dem N17-TLS-Werkzeug jeweils eine neue CA und ein Zertifikat für die Loopback-Adresse. Das Cargo-Fixture-Feature erweitert den Stock-HTTP-Client um die Trust-Datei aus dem temporären Profil. Zertifikatsprüfung und Port-Scope bleiben aktiv. Seatbelt prüft vor dem Start den erlaubten Listener und sperrt den separaten Netzwerk-Canary, die Canary-Datei und Konto-/Keychain-Pfade. Die App verwendet synthetische Sitzungsdaten ohne OAuth oder Updater. Beim Ende werden das temporäre Profil und die Listener freigegeben.

Der Test öffnet die gewählte gerichtete Kante über beide Ticketdetails. Je Vorschau prüft das Ledger zwei `GET /myself` und zwei `GET /issue/{key}?fields=issuelinks`. Die beiden Ticketantworten müssen dieselbe Link-ID, denselben Typ und reziproke Endpunkte liefern. Eine 403-Antwort und einzeln geänderte Link- bzw. Typ-IDs sperren den Vorschlag. Die Konto-Query wird im Fixture erneut über natives HTTPS ausgeführt, während die Antwort des alten Kontos gehalten wird. Nach Freigabe bleibt dessen Vorschau geschlossen. Die nächste bewusste Auswahl liest als neues Konto. Jeder N25-Lauf verlangt null Jira-Schreibrequests.

Im selben Renderer öffnet N10 den normalen Duplikatvergleich aus beiden Ticketperspektiven. Die zwei Tickets liefern dieselbe reziproke Duplikatkante und ausschließlich die Vergleichsfelder. Eine fehlende Priorität bleibt als „Nicht verfügbar“ sichtbar. Ohne passende Gegenkante oder bei 403 bleibt die Vergleichstabelle aus. Die Fixture hält die zweite Ticketantwort einmal bis zur Ticketnavigation und einmal bis zum Wechsel des Kontos. Beide Antworten werden verworfen. Eine neue Auswahl liest sichtbar für das gewechselte Konto. Die GET-Sequenzen und null Jira-Mutationen werden im gemeinsamen Ledger geprüft. Die lokalen Steuerendpunkte ändern den Testablauf und die simulierte Kontoidentität. Jira-Ticketdaten bleiben im Fixture unverändert.

Der WKWebView prüft DOM-Fokus, Escape und Fokusrückgabe. Die Aktivierung nutzt einen DOM-Klick auf der fokussierten Aktion. Systemweite Eingabe und Accessibility, signiertes Packaging, Live-Jira und schreibende Aktionen benötigen eigene Abnahmen.
