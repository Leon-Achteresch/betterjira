# N22 status stays through macOS Tauri IPC

Run from the repository root with the macOS desktop reserved for the test. The shared runner verifies the private paths and Seatbelt canaries before starting the host and removes the fixture state and listeners afterward.

```sh
work=$(mktemp -d /tmp/betterjira-n22.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n22-tauri/vite.config.ts --outDir "$work/native"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/native" n22
```

Open the regular issue history and explicitly select a status. The shared timeline supplies two days of completed stays and one day running at the initial fixture time. The scenario advances that time before a synthetic 403 to verify that the failed read keeps the previous snapshot. Explicit retry advances the snapshot while the history stays partial.

A parked older response returns after navigation to another issue. The old result and selection stay out of the new context and a return to the original issue still shows the previously loaded coverage. The runner requires the exact changelog GETs and zero Jira writes.

The private WKWebView uses DOM events and a controlled clock for the snapshot. Live Jira data and permissions, signed packaging and system accessibility need separate evidence.
