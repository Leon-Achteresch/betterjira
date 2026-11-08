import { describe, expect, it } from "vitest";
import { looksLikeLink, parseTicketReference } from "./ticket-reference";

const SITE = "https://eigene-instanz.atlassian.net";
const parse = (input: string, site: string | undefined = SITE) => parseTicketReference(input, site);

describe("parseTicketReference", () => {
  it("öffnet eigene Browse-Links mit Query und Fragment über den Schlüssel", () => {
    expect(parse(`${SITE}/browse/DEMO-1`)).toEqual({ kind: "link", key: "DEMO-1" });
    expect(parse(`  ${SITE}/browse/demo-12?focusedCommentId=10001&page=x#comment-10001  `)).toEqual({ kind: "link", key: "DEMO-12" });
    expect(parse(`${SITE}/browse/OPS_2-7/`)).toEqual({ kind: "link", key: "OPS_2-7" });
    expect(parse("HTTPS://Eigene-Instanz.Atlassian.NET:443/browse/DEMO-1")).toEqual({ kind: "link", key: "DEMO-1" });
    expect(parse("eigene-instanz.atlassian.net/browse/DEMO-1")).toEqual({ kind: "link", key: "DEMO-1" });
    expect(parse(`${SITE}/browse/DEMO-1`, `${SITE}/`)).toEqual({ kind: "link", key: "DEMO-1" });
  });

  it("lässt Schlüssel und Freitext unverändert", () => {
    expect(parse("demo-1")).toEqual({ kind: "key", key: "DEMO-1" });
    expect(parseTicketReference("demo-1", undefined)).toEqual({ kind: "key", key: "DEMO-1" });
    expect(parse("Login Fehler")).toEqual({ kind: "text" });
    expect(parse("siehe https://eigene-instanz.atlassian.net/browse/DEMO-1")).toEqual({ kind: "text" });
    expect(parse("status:offen")).toEqual({ kind: "text" });
    expect(parse("v1.2")).toEqual({ kind: "text" });
  });

  it.each([
    `${SITE}/browse/DEMO-1?token=secret value`,
    "javascript:alert('secret value')",
    "data:text/plain,secret value",
    `${SITE}/browse/DEMO-1?token=secret\nvalue`,
  ])("leitet fehlerhafte Linkeingaben mit Leerraum nicht an die Volltextsuche weiter: %s", (input) => {
    expect(looksLikeLink(input)).toBe(true);
    expect(parse(input)).toEqual({ kind: "rejected", problem: "invalid" });
  });

  it("lehnt fremde und täuschende Hosts ab", () => {
    for (const link of [
      "https://evil.example/browse/DEMO-1",
      "https://eigene-instanz.atlassian.net.evil.example/browse/DEMO-1",
      "https://eigene-instanz-atlassian.net/browse/DEMO-1",
      "https://xn--eigne-instanz-9db.atlassian.net/browse/DEMO-1",
      "https://еigene-instanz.atlassian.net/browse/DEMO-1",
      "https://eigene-instanz.atlassian.net./browse/DEMO-1",
      "https://eigene-instanz.atlassian.net:8443/browse/DEMO-1",
      "https://andere.atlassian.net/browse/DEMO-1",
      "//evil.example/browse/DEMO-1",
      "https:\\\\evil.example\\browse\\DEMO-1",
    ]) {
      expect(parse(link), link).toEqual({ kind: "rejected", problem: "host" });
    }
  });

  it("lehnt andere Protokolle und Zugangsdaten ab", () => {
    for (const link of ["http://eigene-instanz.atlassian.net/browse/DEMO-1", "ftp://eigene-instanz.atlassian.net/browse/DEMO-1", "javascript:alert(1)", "data:text/html,DEMO-1"]) {
      expect(parse(link), link).toEqual({ kind: "rejected", problem: "protocol" });
    }
    for (const link of ["https://user:pass@eigene-instanz.atlassian.net/browse/DEMO-1", "https://eigene-instanz.atlassian.net@evil.example/browse/DEMO-1"]) {
      expect(parse(link), link).toEqual({ kind: "rejected", problem: "credentials" });
    }
  });

  it("lehnt Pfade ohne gültigen Ticketschlüssel ab", () => {
    for (const path of ["/browse/", "/browse/DEMO", "/browse/1-DEMO", "/browse/DEMO-1/edit", "/browse/DEMO-1%2F..", "/jira/software/projects/DEMO/boards/1", "/issues/DEMO-1", "/browse/DEMO-1-2"]) {
      expect(parse(`${SITE}${path}`), path).toEqual({ kind: "rejected", problem: "path" });
    }
    expect(parse("https://[/browse/DEMO-1")).toEqual({ kind: "rejected", problem: "invalid" });
  });

  it("erklärt Links ohne verbundene Instanz, statt sie zu prüfen", () => {
    expect(parseTicketReference(`${SITE}/browse/DEMO-1`, undefined)).toEqual({ kind: "rejected", problem: "offline" });
  });
});

describe("looksLikeLink", () => {
  it("erkennt Links unabhängig vom Ergebnis der Prüfung", () => {
    expect(looksLikeLink(" https://x.example/a ")).toBe(true);
    expect(looksLikeLink("Übergabe Kunde")).toBe(false);
    expect(looksLikeLink("DEMO-1")).toBe(false);
  });
});
