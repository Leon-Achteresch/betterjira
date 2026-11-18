# C1 through macOS Tauri IPC

Run in a macOS GUI session with the existing Rust cache, Bun and the installed frontend dependencies. From the repository root:

```sh
work=$(mktemp -d /tmp/betterjira-c1-ipc.XXXXXXXX)
VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2 \
  node_modules/.bin/vite build --config tests/native/c1-tauri/vite.config.ts --outDir "$work/dist"
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/dist"
```

The runner starts a synthetic Jira server on a private loopback port. Seatbelt allows only that port and blocks the real home and Keychain paths. A second loopback server and a test file prove the denied paths before the fixture executable starts. The host has a distinct bundle identity and window label, a private Tauri data directory and an incognito WKWebView. Its IPC capability allows the HTTP plugin only on the fixture port. Direct WebView requests are blocked by CSP. The runner removes its temporary app and stops the servers.

The feature-gated example uses the actual Tauri dispatcher, the app's session commands and the stock HTTP plugin. The test build redirects only the Jira REST origin to the fixture. OAuth, the updater and production startup effects are outside this host. No signing or provider credentials are needed.

The scenario enters the regular description editor and checks conflict detection, adoption without a PUT and the exact ADF payload of one confirmed PUT. It then holds a second confirmed read, signs out through the app and releases the matching Jira response. The pending save settles with a single PUT total. Real Jira authentication, distributed app startup and server-side GET-to-PUT atomicity require separate evidence.

The Rust and JavaScript HTTP plugin versions are pinned together. Rust 2.9 expects a different IPC request from JavaScript 2.8.3. Run this fixture when updating the pair.

## Unknown ADF nodes and unresolved media

Build and run the ADF scenario in a separate directory with the same feature-gated host and runner.

```sh
VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2 \
  node_modules/.bin/vite build --config tests/native/c1-tauri/vite.config.ts --mode c1-media --outDir "$work/media"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/media" c1-media
```

The scenario opens the normal description editor and reuses the ADF document from the browser acceptance. It checks readable nested text, source-only nodes, six unresolved media items and exact JSON in both source columns. It also checks that a change confined to an unsupported node invalidates the old acknowledgement. Adopting the Jira revision and closing and reopening the editor preserve the complete draft without a PUT.

After an explicit text edit and fresh confirmation, the stub records one PUT with the complete expected ADF. The final confirmed GET is held while the test signs out. It returns the acknowledged Jira revision, and the draft remains in private storage without another PUT. The stub permits synthetic rendered metadata and records any attachment or media payload request. The WebView also checks for attempts to load the placeholder URLs. Signed packaging, live media resolution and server-side atomicity require separate evidence.

## N12 office TSV in the description editor

```sh
VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2 \
  node_modules/.bin/vite build --config tests/native/c1-tauri/vite.config.ts --mode c1-tsv --outDir "$work/tsv"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/tsv" c1-tsv
```

The scenario enters synthetic TSV directly in the regular import form and types into a cell using WebKit. It exercises input validation, explicit insertion, cancel and resume, and C1's confirmation after a conflicting Jira change. The shared fixture document includes blank cells, literal formula text, an unknown extension, and an existing table with a merged cell.

The fixture verifies zero writes through local editing and one exact ADF PUT after confirmation. A new WebView document reads the saved issue from the synthetic Jira server and reopens the editor with the saved cell values. The host uses its private session and the same Seatbelt checks. The system clipboard, signed packaging and live Jira require separate evidence.
