import http.server
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SANDBOX = ["/usr/bin/sandbox-exec", "-p", "(version 1) (allow default) (deny network-outbound)"]


class Canary(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.hits.append(self.path)
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript")
        self.end_headers()
        self.wfile.write(b"window.c1CanaryReached = true")


def curl(url, prefix=()):
    return subprocess.run(
        [*prefix, "/usr/bin/curl", "--noproxy", "*", "--fail", "--silent",
         "--show-error", "--max-time", "3", "--output", "/dev/null", url],
        capture_output=True, text=True,
    )


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run_isolated(fixture, executable, home):
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), Canary) as canary:
        canary.hits = []
        threading.Thread(target=canary.serve_forever, daemon=True).start()
        try:
            trap = f"http://127.0.0.1:{canary.server_port}"
            require(curl(trap + "/control").returncode == 0, "Canary not listening")
            denied = curl(trap + "/seatbelt", SANDBOX)
            require(denied.returncode == 7 and canary.hits == ["/control"],
                    f"Seatbelt did not block outbound connections: {denied.stderr}")
            print(f"Seatbelt preflight: all network-outbound denied, canary {canary.server_port} unreachable (curl 7)", flush=True)
            child_env = {"PATH": "/usr/bin:/bin", "HOME": str(home),
                         "CFFIXED_USER_HOME": str(home), "TMPDIR": str(home / "tmp")}
            result = subprocess.run([
                *SANDBOX, str(executable), str(fixture), trap, str(HERE / "scenario.js"),
                str(REPO / "tests/jira/fixtures/description-adf-media.json"),
            ], env=child_env, timeout=90)
            require(canary.hits == ["/control"], f"Disallowed HTTP requests reached canary: {canary.hits}")
            result.check_returncode()
            print("Network canary: one positive control, zero hits from the isolated host or WKWebView")
        finally:
            canary.shutdown()


def main():
    require(sys.platform == "darwin", "This test requires macOS")
    require(len(sys.argv) == 2, "Usage: python3 tests/native/c1-macos/run.py <Vite production build directory>")
    built = Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory(prefix="betterjira-c1-wkwebview-") as directory:
        private = Path(directory).resolve()
        home = private / "home"
        (home / "tmp").mkdir(parents=True)
        fixture = private / "fixture"
        shutil.copytree(built, fixture)
        subprocess.run(["node", str(REPO / ".github/scripts/derive-browser-fixture.mjs"),
                        str(REPO), str(fixture)], check=True)
        executable = private / "BetterJiraC1Fixture"
        subprocess.run(["/usr/bin/swiftc", "-j", "2", "-parse-as-library", str(HERE / "Harness.swift"),
                        "-o", str(executable)], check=True)
        run_isolated(fixture, executable, home)


if __name__ == "__main__":
    main()
