import http.server
import json
import os
from pathlib import Path
import plistlib
import pwd
import select
import shutil
import subprocess
import sys
import tempfile
import threading


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]


class Canary(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.server.hits.append(self.path)
        self.send_response(200)
        self.end_headers()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def curl(url, sandbox=(), env=None, authenticated=False):
    headers = ["-H", "Authorization: Bearer mock"] if authenticated else []
    return subprocess.run([*sandbox, "/usr/bin/curl", "--noproxy", "*", "--fail",
                           "--silent", "--show-error", "--max-time", "3", *headers, url],
                          capture_output=True, text=True, env=env)


def run_host(root, executable, port, guard, scenario, case):
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), Canary) as canary:
        canary.hits = []
        threading.Thread(target=canary.serve_forever, daemon=True).start()
        try:
            real_home = json.dumps(str(Path(pwd.getpwuid(os.getuid()).pw_dir).resolve()))
            profile = (
                '(version 1) (allow default) (deny network-outbound) '
                f'(allow network-outbound (remote ip "localhost:{port}")) '
                f'(deny file-read* file-write* (subpath {real_home}) '
                f'(subpath "/Library/Keychains") (literal {json.dumps(str(guard))})) '
                '(deny mach-lookup (global-name "com.apple.securityd") (global-name "com.apple.secd"))'
            )
            sandbox = ["/usr/bin/sandbox-exec", "-p", profile]
            env = {"PATH": "/usr/bin:/bin", "HOME": str(root / "home"), "CFFIXED_USER_HOME": str(root / "home"),
                   "TMPDIR": str(root / "tmp"), "C1_IPC_TEST_ROOT": str(root), "C1_IPC_JIRA_PORT": str(port),
                   "C1_IPC_CANARY_PORT": str(canary.server_port), "C1_IPC_SCENARIO": scenario,
                   "TOKIO_WORKER_THREADS": "2"}
            fixture = f"http://127.0.0.1:{port}"
            trap = f"http://127.0.0.1:{canary.server_port}"
            require(curl(trap + "/control").returncode == 0, "Canary is not reachable outside the sandbox")
            allowed = curl(f"{fixture}/__{scenario}/probe", sandbox, env)
            require(allowed.returncode == 0 and json.loads(allowed.stdout) == {"fixture": True},
                    f"Fixture is unreachable in Seatbelt: {allowed.stderr}")
            denied = curl(trap + "/seatbelt", sandbox, env)
            require(denied.returncode == 7 and canary.hits == ["/control"],
                    f"Seatbelt allowed non-fixture egress: {denied.stderr}")
            denied_read = subprocess.run([*sandbox, "/bin/cat", str(guard)], env=env, capture_output=True)
            require(guard.read_text() == "private canary" and denied_read.returncode != 0 and not denied_read.stdout,
                    "Seatbelt did not deny the out-of-scope file read")
            print(f"Seatbelt preflight: only fixture port {port} allowed. Canary port {canary.server_port} "
                  "and out-of-scope file denied. Real home and Keychain paths restricted.", flush=True)
            result = subprocess.run([*sandbox, str(executable)], cwd=root, env=env, timeout=90)
            require(canary.hits == ["/control"], f"Blocked canary received unexpected traffic: {canary.hits}")
            state = curl(f"{fixture}/__{scenario}/state", authenticated=True)
            state.check_returncode()
            ledger = json.loads(state.stdout)
            print("Native fixture ledger:", json.dumps(ledger, ensure_ascii=False), flush=True)
            result.check_returncode()
            require(ledger["unexpected"] == 0 and not ledger["held"], f"Unexpected final fixture ledger: {ledger}")
            if scenario == "c1":
                media = case == "c1-media"
                require(len(ledger["writes"]) == 1 and len(ledger["reads"]) == (6 if media else 5),
                        f"Unexpected C1 fixture ledger: {ledger}")
                if media:
                    require(ledger["mediaRequests"] == [] and ledger["renderedReads"] > 0,
                            f"Unexpected C1 media fixture ledger: {ledger}")
            elif scenario == "n01":
                require(sorted((entry["target"], entry["status"]) for entry in ledger["writes"]) ==
                        [("DEMO-2", 201), ("DEMO-3", 403), ("DEMO-5", 503)] and
                        ledger["released"] == ["DEMO-6", "DEMO-7"], f"Unexpected N01 fixture ledger: {ledger}")
            elif case in ("n02-control", "n03-control"):
                require(not ledger["writes"] and not ledger["released"], f"{scenario} read-only control dispatched: {ledger}")
            elif scenario == "n02":
                require([entry["status"] for entry in ledger["writes"]] == [204, 403, 204, 503, 204] and
                        ledger["released"] == ["GET DEMO-7", "PUT DEMO-7"], f"Unexpected N02 fixture ledger: {ledger}")
            else:
                require([entry["status"] for entry in ledger["writes"]] == [201, 401, 503, 201] and
                        ledger["released"] == ["GET parent", "POST issue"], f"Unexpected N03 fixture ledger: {ledger}")
            require(not list((root / "data").rglob("61746c61737369616e2d73657373696f6e")),
                    "Private session file still exists after logout")
            print("Network canary: one unsandboxed loopback control, zero hits from the isolated host or WebView")
        finally:
            canary.shutdown()


def main():
    require(sys.platform == "darwin", "This fixture requires macOS")
    require(len(sys.argv) in (3, 4), "Usage: python3 tests/native/c1-tauri/run.py <fixture executable> <fixture build> [c1|c1-media|n01|n02|n02-control|n03|n03-control]")
    case = sys.argv[3] if len(sys.argv) == 4 else "c1"
    require(case in ("c1", "c1-media", "n01", "n02", "n02-control", "n03", "n03-control"), "Unknown IPC fixture scenario")
    scenario = case.split("-")[0]
    fixture_dir = HERE.parent / f"{scenario}-tauri"
    binary = Path(sys.argv[1]).resolve(strict=True)
    build = Path(sys.argv[2]).resolve(strict=True)
    require(binary.name == "c1_ipc_fixture", "Expected the feature-gated C1 example executable")
    require((build / fixture_dir.relative_to(REPO) / "fixture.html").is_file(), "Expected the selected scenario build")
    name = f"betterjira {scenario.upper()} IPC Fixture"
    with tempfile.TemporaryDirectory(prefix=f"betterjira-{case}-tauri-", dir="/tmp") as directory:
        root = Path(directory).resolve()
        for folder in ("home", "tmp", "data"):
            (root / folder).mkdir(mode=0o700)
        guard = root / "denied-read-canary"
        guard.write_text("private canary")
        shutil.copytree(build, root / "dist")
        bundle = root / f"BetterJira{scenario.upper()}Fixture.app" / "Contents"
        executable = bundle / "MacOS" / bundle.parent.stem
        executable.parent.mkdir(parents=True)
        shutil.copy2(binary, executable)
        with (bundle / "Info.plist").open("wb") as info:
            plistlib.dump({"CFBundleIdentifier": f"com.leon.betterjira.{scenario}-ipc-fixture",
                           "CFBundleName": name, "CFBundlePackageType": "APPL",
                           "CFBundleExecutable": executable.name, "LSUIElement": True}, info)
        server = subprocess.Popen(["bun", str(fixture_dir / "server.ts"), *(["media"] if case == "c1-media" else [])],
                                  stdout=subprocess.PIPE, text=True, cwd=REPO)
        try:
            require(bool(select.select([server.stdout], [], [], 10)[0]), "Jira fixture did not start")
            port = int(server.stdout.readline())
            require(0 < port < 65536 and server.poll() is None, "Jira fixture did not bind a private port")
            run_host(root, executable, port, guard, scenario, case)
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
            server.stdout.close()


if __name__ == "__main__":
    main()
