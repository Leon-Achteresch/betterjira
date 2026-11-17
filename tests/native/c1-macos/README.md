# C1 in macOS WKWebView

Run on macOS with a logged-in GUI session, the Swift command line tools, Python 3, and the project's installed dependencies. From the repository root:

```sh
build_dir=$(mktemp -d)
VITE_ATLASSIAN_CLIENT_ID= VITE_ATLASSIAN_CLIENT_SECRET= RAYON_NUM_THREADS=2 GOMAXPROCS=2 \
  node_modules/.bin/vite build --outDir "$build_dir"
python3 tests/native/c1-macos/run.py "$build_dir"
```

The runner copies the build to a private directory and derives the existing browser fixture. It verifies Seatbelt denies all outbound connections before starting the Swift host. WKWebView serves the fixture through a read-only internal URL scheme. It uses a nonpersistent data store, private home and temp paths, request and navigation allowlists, and a restrictive content security policy. Its only window is a separate nonactivating panel, shown after a second isolation check inside WebKit.

The fixture exercises the regular issue route with the existing synthetic Jira bridge. It checks the exact ADF source and the single confirmed PUT. The test drives the WebKit DOM and uses synthetic key events. Tauri IPC, OS keyboard and clipboard behavior, live Jira, and the server-side GET-to-PUT race require separate evidence.
