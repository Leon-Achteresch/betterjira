# N17 internal source quotes through macOS Tauri IPC

Run from the repository root with the macOS desktop reserved for this fixture.

```sh
work=$(mktemp -d /tmp/betterjira-n17.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n17-tauri/vite.config.ts --outDir "$work/native"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/native" n17
```

The private host registers the real Zammad connect, connection read, request and disconnect commands. The runner creates a short-lived CA and a server certificate for 127.0.0.1 inside its temporary root. Seatbelt permits the Jira/control and HTTPS Zammad ports and blocks the separate network and file canaries before startup. The fixture enables trust for its local CA and exact HTTPS origin only. Its native client keeps certificate verification active and uses the private app directory for synthetic credentials.

The regular conversation rereads the selected article. The composer keeps the original email and recipients while preparing a separate, editable internal quote. The ledger accepts one explicitly submitted plaintext note with the exact payload and no recipients or attachments.

The fixture parks a quote read and uses the real connect command to rotate synthetic credentials A→B→A at the same origin. It triggers the existing connection query to observe each new revision. The late response does not reopen the old preview. Requests that carry the original revision are rejected before HTTPS. The scenario disconnects and the runner verifies removal of the private credential file.

The local proof uses synthetic accounts and DOM events in a private WKWebView. Live Zammad permissions and response behavior, system accessibility and signed packaging need separate evidence.
