# N05 dependency neighborhoods through macOS Tauri IPC

Run from the repository root with the macOS GUI session reserved for this fixture. The shared runner verifies the loopback port and the blocked network and file canaries before starting the private app. It removes the app's temporary state and listeners on exit.

```sh
work=$(mktemp -d /tmp/betterjira-n05.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n05-tauri/vite.config.ts --outDir "$work/native"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/native" n05
```

The production renderer opens the ticket links section and explicitly chooses outgoing or incoming Blocks links. The native HTTP fixture records the exact traversal and provides a duplicate, a cycle back to the source, two paths to one other-project ticket, a 403, and a branch set that reaches the request and ticket limits. The UI shows the depth boundary and partial coverage.

The fixture holds a branch response during ticket navigation and during a synthetic account change. For the second case the test triggers the existing account query against the local `/myself` endpoint. Each late response belongs to its original scope. The traversal under the new account starts only after an explicit selection and load. The final ledger requires zero Jira writes and zero unexpected requests.

The native run uses DOM events in a private WKWebView. Real account authentication and permissions, signed packaging, and system-level accessibility are separate checks. The related browser coverage lives in `tests/browser/dependency-neighborhood.e2e.ts`.
