import { describe, expect, it } from "vitest";
import { jiraCommentUrl } from "./comment-link";

describe("jiraCommentUrl", () => {
  it("baut den offiziellen Kommentar-Permalink", () => {
    expect(jiraCommentUrl("https://acme.atlassian.net", "DEMO-1", "10001")).toBe(
      "https://acme.atlassian.net/browse/DEMO-1?focusedCommentId=10001#comment-10001",
    );
  });

  it("entfernt abschließende Schrägstriche, Query und Fragment der Basis", () => {
    expect(jiraCommentUrl("https://acme.atlassian.net///?os_authType=basic#top", "DEMO-1", "7")).toBe(
      "https://acme.atlassian.net/browse/DEMO-1?focusedCommentId=7#comment-7",
    );
  });

  it("behält Kontextpfad und Port", () => {
    expect(jiraCommentUrl("https://jira.example.com:8443/jira/", "OPS-12", "42")).toBe(
      "https://jira.example.com:8443/jira/browse/OPS-12?focusedCommentId=42#comment-42",
    );
  });

  it("normalisiert Groß-/Kleinschreibung und Standardport des Hosts", () => {
    expect(jiraCommentUrl("HTTPS://ACME.Atlassian.NET:443", "DEMO-1", "1")).toBe(
      "https://acme.atlassian.net/browse/DEMO-1?focusedCommentId=1#comment-1",
    );
  });

  it("encodiert Schlüssel und Kommentar-ID", () => {
    const url = jiraCommentUrl("https://acme.atlassian.net", "A/../B?x#y", "1&x=2#z /ä");
    expect(url).toBe(
      "https://acme.atlassian.net/browse/A%2F..%2FB%3Fx%23y?focusedCommentId=1%26x%3D2%23z+%2F%C3%A4#comment-1%26x%3D2%23z%20%2F%C3%A4",
    );
    const parsed = new URL(url ?? "");
    expect(parsed.pathname).toBe("/browse/A%2F..%2FB%3Fx%23y");
    expect(parsed.searchParams.get("focusedCommentId")).toBe("1&x=2#z /ä");
    expect([...parsed.searchParams.keys()]).toEqual(["focusedCommentId"]);
  });

  it.each([
    ["fehlende Verbindung", undefined],
    ["leere Adresse", ""],
    ["nur Leerzeichen", "   "],
    ["ungültige Adresse", "nicht eine url"],
    ["http", "http://acme.atlassian.net"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/html,x"],
    ["file", "file:///C:/jira"],
    ["Benutzer in der Adresse", "https://user@acme.atlassian.net"],
    ["Zugangsdaten in der Adresse", "https://user:secret@acme.atlassian.net"],
    ["ohne Host", "https://"],
  ])("lehnt %s ab", (_, siteUrl) => {
    expect(jiraCommentUrl(siteUrl, "DEMO-1", "1")).toBeNull();
  });

  it("lehnt leere Schlüssel und IDs ab", () => {
    expect(jiraCommentUrl("https://acme.atlassian.net", "", "1")).toBeNull();
    expect(jiraCommentUrl("https://acme.atlassian.net", "DEMO-1", " ")).toBeNull();
  });
});
