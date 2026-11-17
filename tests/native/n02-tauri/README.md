# N02 due-date TSV through macOS Tauri IPC

Run from the repository root in a macOS GUI session reserved for this fixture. The shared C1 runner checks Seatbelt before launch and removes its private app and listeners on exit.

```sh
work=$(mktemp -d /tmp/betterjira-n02-ipc.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n02-tauri/vite.config.ts --outDir "$work/apply"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/apply" n02
node_modules/.bin/vite build --config tests/native/n02-tauri/vite.config.ts --mode n02-control --outDir "$work/control"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/control" n02-control
```

The fixture opens the real search, selection and bulk-edit UI. The test build rewrites the REST origin to the loopback stub. Its replacement capability requires the fixture host marker, Tauri origin and synthetic Jira account and site. Both runs use the actual Tauri dispatcher and native HTTP plugin. The control build retains the production capability and displays the TSV preview with zero PUTs, even with the host marker present.

The mixed run checks explicit confirmation, input revisions, different per-ticket dates, no PUTs for unselected or stale assignments, HTTP 204/403/503 outcomes, and no retry after an unclear result. It also releases a preflight GET after selection loss and returns a previously dispatched PUT after sign-out. The late success is recorded against its original mutation, and the next row stays unwritten.

The fixture uses DOM events in an incognito WKWebView. Signed packaging, system accessibility, effective Live Jira permissions and the server-side GET-to-PUT contract require separate evidence.
