# N01 über macOS-Tauri-IPC

Aus dem Repository-Root in einer für die Prüfung freigegebenen macOS-GUI-Sitzung ausführen. Der C1-Runner prüft die Isolation vor dem Start und räumt seine App, Sitzung und Listener anschließend auf.

```sh
work=$(mktemp -d /tmp/betterjira-n01-ipc.XXXXXXXX)
VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2 \
  node_modules/.bin/vite build --config tests/native/n01-tauri/vite.config.ts --outDir "$work/dist"
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/dist" n01
```

Das N01-Szenario verwendet eine eigene App-ID, ein Inkognito-WKWebView und eine private Sitzungsdatei. Die Seatbelt-Prüfung erlaubt den dynamischen Jira-Fixture-Port und sperrt den zweiten Loopback-Port sowie eine Testdatei. Der WebView prüft die HTTP-ACL, die CSP und die fehlenden OAuth-/Updater-Befehle. Der Tauri-Dispatcher, die App-Sitzungsbefehle und das native HTTP-Plugin bleiben aktiv. Der Fixture-Build ersetzt den Jira-REST-Origin durch den privaten Loopback-Origin und beobachtet das Ende der echten Link-Mutationen.

Die Prüfung öffnet **Mehrere Tickets verknüpfen** in DEMO-4. Sie prüft das 20er-Limit, die explizite Zielmenge und die gelesene Vorschau. Bestätigte Einzel-POSTs ergeben HTTP 201, 403 und 503. Das Fixture speichert den Link vor der 503-Antwort, damit die Oberfläche ihn als unklar behandelt und unangetastet lässt. Eine geänderte Ziel-ID sperrt die vierte Abgabe. Zwei weitere bestätigte Läufe werden beim letzten Rechte-GET angehalten. Beim Ticketwechsel und bei der Abmeldung endet der jeweilige Lauf nach Freigabe der Antwort ohne neuen POST.

Signiertes Packaging, Screenreader, Live-Jira-Rechte und das Verhalten zwischen letzter Prüfung und abgesendetem POST benötigen separate Nachweise. Die Interaktionen im WebView werden über DOM-Ereignisse ausgelöst.
