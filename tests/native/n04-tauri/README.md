# N04 relative due dates through macOS Tauri IPC

Run from the repository root in a macOS GUI session reserved for this fixture. The shared runner checks Seatbelt before launching the private app and removes its temporary state and listeners on exit.

```sh
work=$(mktemp -d /tmp/betterjira-n04.XXXXXXXX)
export VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2
env -u TAURI_CONFIG CARGO_BUILD_JOBS=2 cargo build --locked --offline \
  --manifest-path src-tauri/Cargo.toml --features c1-ipc-fixture --example c1_ipc_fixture
node_modules/.bin/vite build --config tests/native/n04-tauri/vite.config.ts --outDir "$work/native"
python3 tests/native/c1-tauri/run.py src-tauri/target/debug/examples/c1_ipc_fixture "$work/native" n04
```

The scenario opens the existing search and bulk editor. It uses the ordinary date-shift code and the actual Tauri HTTP dispatcher, with the REST origin pointed at the loopback stub. The browser spec `tests/browser/due-date-shift.e2e.ts` uses the same seed dates and HTTP outcomes. It covers keyboard input, Escape, narrow layouts and loss of account scope during a held GET.

In the native fixture, closing the preview sends no PUT. After confirmation the stub records absolute dates, a 403 rejection and a 503 after a simulated change. The 503 is recorded as unclear and the next eligible row still runs. The fixture also releases a GET after the stop action and releases a previously sent PUT after sign-out. Neither starts an additional PUT.

The native test uses DOM events in an incognito WKWebView. Signed packaging, OS-level accessibility, effective live Jira rights and atomicity between GET and PUT require separate evidence.
