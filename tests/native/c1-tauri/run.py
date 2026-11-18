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


def curl(url, sandbox=(), env=None, authenticated=False, ca=None):
    headers = ["-H", "Authorization: Bearer mock"] if authenticated else []
    trust = ["--cacert", str(ca)] if ca else []
    return subprocess.run([*sandbox, "/usr/bin/curl", "--noproxy", "*", "--fail",
                           "--silent", "--show-error", "--max-time", "3", *trust, *headers, url],
                          capture_output=True, text=True, env=env)


def run_host(root, executable, port, guard, scenario, case, zammad_port=None):
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), Canary) as canary:
        canary.hits = []
        threading.Thread(target=canary.serve_forever, daemon=True).start()
        try:
            real_home = json.dumps(str(Path(pwd.getpwuid(os.getuid()).pw_dir).resolve()))
            allowed_ports = [port, zammad_port] if zammad_port else [port]
            require(canary.server_port not in allowed_ports, "Canary must be on its own port")
            allow = ' '.join(f'(allow network-outbound (remote ip "localhost:{p}"))' for p in allowed_ports)
            profile = (
                '(version 1) (allow default) (deny network-outbound) '
                f'{allow} '
                f'(deny file-read* file-write* (subpath {real_home}) '
                f'(subpath "/Library/Keychains") (literal {json.dumps(str(guard))})) '
                '(deny mach-lookup (global-name "com.apple.securityd") (global-name "com.apple.secd"))'
            )
            sandbox = ["/usr/bin/sandbox-exec", "-p", profile]
            jira_tls = scenario == "n25"
            ca = root / "tls/ca.pem" if jira_tls or zammad_port else root / "no-platform-trust.pem"
            if not (jira_tls or zammad_port):
                ca.touch(mode=0o600)
            env = {"PATH": "/usr/bin:/bin", "HOME": str(root / "home"), "CFFIXED_USER_HOME": str(root / "home"),
                   "TMPDIR": str(root / "tmp"), "C1_IPC_TEST_ROOT": str(root), "C1_IPC_JIRA_PORT": str(port),
                   "C1_IPC_CANARY_PORT": str(canary.server_port), "C1_IPC_SCENARIO": scenario,
                   "NO_PROXY": "127.0.0.1", "SSL_CERT_FILE": str(ca), "TOKIO_WORKER_THREADS": "2"}
            fixture = f"{'https' if jira_tls else 'http'}://127.0.0.1:{port}"
            trap = f"http://127.0.0.1:{canary.server_port}"
            require(curl(trap + "/control").returncode == 0, "Canary is not reachable outside the sandbox")
            allowed = curl(f"{fixture}/__{scenario}/probe", sandbox, env, ca=ca if jira_tls else None)
            require(allowed.returncode == 0 and json.loads(allowed.stdout) == {"fixture": True},
                    f"Fixture is unreachable in Seatbelt: {allowed.stderr}")
            if zammad_port:
                env["C1_IPC_ZAMMAD_PORT"] = str(zammad_port)
                allowed_tls = curl(f"https://127.0.0.1:{zammad_port}/probe", sandbox, env, ca=root/"tls/ca.pem")
                require(allowed_tls.returncode == 0 and json.loads(allowed_tls.stdout) == {"fixture": True},
                        f"Zammad TLS fixture is unreachable in Seatbelt: {allowed_tls.stderr}")
            denied = curl(trap + "/seatbelt", sandbox, env)
            require(denied.returncode == 7 and canary.hits == ["/control"],
                    f"Seatbelt allowed non-fixture egress: {denied.stderr}")
            denied_read = subprocess.run([*sandbox, "/bin/cat", str(guard)], env=env, capture_output=True)
            require(guard.read_text() == "private canary" and denied_read.returncode != 0 and not denied_read.stdout,
                    "Seatbelt did not deny the out-of-scope file read")
            port_description = f"fixture port {port}" if not zammad_port else f"fixture ports {port} and {zammad_port}"
            if jira_tls or zammad_port:
                port_description += " (verified private HTTPS)"
            print(f"Seatbelt preflight: only {port_description} allowed. Canary port {canary.server_port} "
                  "and out-of-scope file denied. Real home and Keychain paths restricted.", flush=True)
            result = subprocess.run([*sandbox, str(executable)], cwd=root, env=env, timeout=90)
            require(canary.hits == ["/control"], f"Blocked canary received unexpected traffic: {canary.hits}")
            state = curl(f"{fixture}/__{scenario}/state", authenticated=True, ca=ca if jira_tls else None)
            state.check_returncode()
            ledger = json.loads(state.stdout)
            print("Native fixture ledger:", json.dumps(ledger, ensure_ascii=False), flush=True)
            result.check_returncode()
            require(ledger["unexpected"] == 0 and not ledger["held"], f"Unexpected final fixture ledger: {ledger}")
            if scenario == "c1":
                media = case == "c1-media"
                expected_reads = {"c1": 5, "c1-media": 6, "c1-tsv": 2}
                require(len(ledger["writes"]) == 1 and len(ledger["reads"]) == expected_reads[case],
                        f"Unexpected C1 fixture ledger: {ledger}")
                if media:
                    require(ledger["mediaRequests"] == [] and ledger["renderedReads"] > 0,
                            f"Unexpected C1 media fixture ledger: {ledger}")
                if case == "c1-tsv":
                    detail = curl(f"{fixture}/__c1/ticket-reads", authenticated=True)
                    detail.check_returncode()
                    reads = json.loads(detail.stdout)
                    print("Native TSV issue detail reads:", json.dumps(reads, ensure_ascii=False), flush=True)
                    written = ledger["writes"][0]
                    require(written["status"] == 204 and len(reads) >= 2 and
                            reads[-1] == {"status": 200, "description": written["payload"]["fields"]["description"]},
                            "Reload did not read back the written TSV description")
            elif scenario == "n01":
                require(sorted((entry["target"], entry["status"]) for entry in ledger["writes"]) ==
                        [("DEMO-2", 201), ("DEMO-3", 403), ("DEMO-5", 503)] and
                        ledger["released"] == ["DEMO-6", "DEMO-7"], f"Unexpected N01 fixture ledger: {ledger}")
            elif case in ("n02-control", "n03-control"):
                require(not ledger["writes"] and not ledger["released"], f"{scenario} read-only control dispatched: {ledger}")
            elif scenario == "n02":
                require([entry["status"] for entry in ledger["writes"]] == [204, 403, 204, 503, 204] and
                        ledger["released"] == ["GET DEMO-7", "PUT DEMO-7"], f"Unexpected N02 fixture ledger: {ledger}")
            elif scenario == "n03":
                require([entry["status"] for entry in ledger["writes"]] == [201, 401, 503, 201] and
                        ledger["released"] == ["GET parent", "POST issue"], f"Unexpected N03 fixture ledger: {ledger}")
            elif scenario == "n04":
                require([entry["status"] for entry in ledger["writes"]] == [204, 403, 503, 204, 204] and
                        ledger["released"] == ["GET DEMO-1", "PUT DEMO-1"], f"Unexpected N04 fixture ledger: {ledger}")
            elif scenario == "n05":
                require(not ledger["writes"] and not ledger["armed"] and
                        ledger["released"] == [["ticket", "DEMO-11"], ["account", "DEMO-11"]],
                        f"Unexpected N05 fixture ledger: {ledger}")
            elif scenario == "n09":
                endpoint = "/ex/jira/mock-cloud/rest/api/3/search/jql"
                expected_searches = [
                    {"method": "GET", "path": endpoint, "params": {
                        "jql": f'project = "{project}" AND (summary ~ "Gateway*" OR summary ~ "Fehler*") ORDER BY updated DESC',
                        "fields": "summary,project,status,issuetype", "maxResults": "10",
                    }} for project in ("10100", "10100", "10101")
                ]
                require(not ledger["writes"] and ledger["searches"] == expected_searches and
                        ledger["released"] == [2] and ledger["details"] == [{"key": "DEMO-1", "status": 200}],
                        f"Unexpected N09 fixture ledger: {ledger}")
            elif scenario == "n17":
                require(len(ledger["writes"]) == 1 and ledger["released"] == ["A"], f"Unexpected N17 fixture ledger: {ledger}")
                write = ledger["writes"][0]
                body = write["body"]
                require(write["method"] == "POST" and write["path"] == "/api/v1/ticket_articles" and write["credential"] == "A"
                        and body["ticket_id"] == 41 and body["internal"] is True and body["type"] == "note"
                        and body["content_type"] == "text/plain" and not {"to", "cc", "in_reply_to"} & body.keys(),
                        f"Unexpected N17 write: {write}")
            elif scenario == "n16":
                source = "/api/v1/ticket_articles/by_ticket/41?expand=true"
                require(not ledger["writes"] and not ledger["armed"] and ledger["released"] == [
                    {"label": "identity", "path": "/api/v1/users/me", "credential": "A"},
                    {"label": "ticket", "path": source, "credential": "A"},
                    {"label": "account", "path": source, "credential": "A"},
                ] and any(item == {"path": source, "credential": "A", "status": 403}
                          for item in ledger["sourceReads"]), f"Unexpected N16 fixture ledger: {ledger}")
            elif scenario == "n22":
                expected_reads = [
                    {"method": "GET", "path": f"/ex/jira/mock-cloud/rest/api/3/issue/{key}/changelog",
                     "params": {"startAt": str(start), "maxResults": str(size)}, "status": status}
                    for key, start, size, status in [
                        ("DEMO-1", 0, 20, 200), ("DEMO-1", 26, 20, 200), ("DEMO-1", 6, 20, 403),
                        ("DEMO-1", 6, 20, 200), ("DEMO-1", 0, 6, 200), ("DEMO-2", 0, 20, 200),
                    ]
                ]
                require(not ledger["writes"] and ledger["reads"] == expected_reads and ledger["released"] == [5],
                        f"Unexpected N22 fixture ledger: {ledger}")
            elif scenario == "n25":
                require(not ledger["writes"] and ledger["released"] == ["account"] and ledger["transport"] == "https",
                        f"Unexpected N25 fixture ledger: {ledger}")
            if zammad_port:
                require(not list((root / "data").rglob("7a616d6d61642d636f6e6e656374696f6e")),
                        "Private Zammad credential file still exists after disconnect")
            require(not list((root / "data").rglob("61746c61737369616e2d73657373696f6e")),
                    "Private session file still exists after logout")
            print("Network canary: one unsandboxed loopback control, zero hits from the isolated host or WebView")
        finally:
            canary.shutdown()


def main():
    require(sys.platform == "darwin", "This fixture requires macOS")
    cases = ("c1", "c1-media", "c1-tsv", "n01", "n02", "n02-control", "n03", "n03-control", "n04", "n05", "n09", "n16", "n17", "n22", "n25")
    require(len(sys.argv) in (3, 4), "Usage: python3 tests/native/c1-tauri/run.py <fixture executable> <fixture build> [" + "|".join(cases) + "]")
    case = sys.argv[3] if len(sys.argv) == 4 else "c1"
    require(case in cases, "Unknown IPC fixture scenario")
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
        variant = [case.removeprefix("c1-")] if case in ("c1-media", "c1-tsv") else []
        zammad_tls = scenario in ("n16", "n17")
        tls_tools = HERE.parent / "n17-tauri"
        server_dir = tls_tools if zammad_tls else fixture_dir
        if zammad_tls or scenario == "n25":
            tls = root / "tls"
            subprocess.run([sys.executable, str(tls_tools / "tls.py"), str(tls)], check=True)
            variant = [str(tls), scenario] if zammad_tls else [str(tls)]
        server = subprocess.Popen(["bun", str(server_dir / "server.ts"), *variant],
                                  stdout=subprocess.PIPE, text=True, cwd=REPO)
        try:
            require(bool(select.select([server.stdout], [], [], 10)[0]), "Jira fixture did not start")
            ports = [int(port) for port in server.stdout.readline().split()]
            require(len(ports) == (2 if zammad_tls else 1) and len(set(ports)) == len(ports) and
                    all(0 < port < 65536 for port in ports) and server.poll() is None, "Fixture did not bind distinct private ports")
            run_host(root, executable, ports[0], guard, scenario, case, ports[1] if zammad_tls else None)
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
            server.stdout.close()
    require(not root.exists() and server.poll() is not None, "Private fixture resources survived cleanup")
    print(f"Fixture cleanup: server {server.pid} stopped, private root {root} removed.", flush=True)


if __name__ == "__main__":
    main()
