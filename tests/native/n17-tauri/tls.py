from pathlib import Path
import subprocess
import sys


def prepare_tls(directory: Path):
    directory.mkdir(mode=0o700)
    (directory / "openssl.cnf").write_text(
        "[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=betterjira N17 fixture\n"
        "[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n"
        "[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n"
        "extendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n"
    )

    def openssl(*args):
        result = subprocess.run(["/usr/bin/openssl", *args], cwd=directory, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)

    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-sha256",
            "-config", "openssl.cnf", "-extensions", "ca", "-keyout", "ca.key", "-out", "ca.pem")
    openssl("req", "-newkey", "rsa:2048", "-nodes", "-config", "openssl.cnf",
            "-keyout", "server.key", "-out", "server.csr")
    openssl("x509", "-req", "-in", "server.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
            "-CAcreateserial", "-out", "server.pem", "-days", "2", "-sha256",
            "-extfile", "openssl.cnf", "-extensions", "server")


if __name__ == "__main__":
    prepare_tls(Path(sys.argv[1]))
