# N03 subtask rows through macOS Tauri IPC

Run from the repository root in a macOS GUI session reserved for the test. The shared runner checks Seatbelt before activating the private app and removes its temporary state and listeners on exit.

```sh
work=$(mktemp -d /tmp/betterjira-n03-ipc.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n03-tauri/vite.config.ts --mode n03-submit --outDir "$work/submit"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/submit" n03
node_modules/.bin/vite build --config tests/native/n03-tauri/vite.config.ts --mode n03-control --outDir "$work/control"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/control" n03-control
```

Both variants enter the actual subtask creation page from the issue detail. The control preserves the independent single draft and shows a read-only multi-row preview with the native fixture marker present. The submit build grants the capability only in the isolated Tauri context with the synthetic account, site and loopback origin.

The ledger checks row order and exact parent, project and issue type IDs. In the mixed run the stub returns 201, 401 and 503. The last response models creation followed by an unclear answer. The next row stays unwritten and neither response is retried. A held parent GET after leaving the form produces no POST. A POST sent before sign-out can still return 201 to its original mutation, without sending any further rows.

The fixture exercises native HTTP via DOM events in a private WKWebView. Signed packaging, system accessibility, effective Jira permissions and idempotency require separate evidence.
