# N09 related tickets through macOS Tauri IPC

Run from the repository root with a reserved macOS desktop. The shared runner verifies Seatbelt before starting the private app and removes its state and listeners afterward.

```sh
work=$(mktemp -d /tmp/betterjira-n09.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n09-tauri/vite.config.ts --outDir "$work/native"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/native" n09
```

The production renderer enters the existing create form from the app header. The fixture exercises an explicit project-scoped title search, its partial coverage, and the real detail route. Returning to the create form preserves the original type, title, description and required customer field.

The stub parks the second DEMO response until the renderer switches to OPS. The late DEMO page stays out of the form. An explicit search in OPS shows only its current result. The runner verifies the exact Jira search requests, one DEMO-1 detail read and zero Jira writes.

The test drives DOM events in a private WKWebView and reuses the search page from the browser fixture. Live match quality and permissions, system accessibility, the system clipboard and signed packaging require separate evidence.
