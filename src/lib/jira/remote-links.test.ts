import { describe, expect, it } from "vitest";
import { jiraKeys } from "./queries";
import { openableUrl, remoteLinkKeys, summarizeRemoteLinks } from "./remote-links";

const confluence = {
  id: 10000,
  self: "https://qa.atlassian.net/rest/api/issue/DEMO-1/remotelink/10000",
  globalId: "appId=1&pageId=2",
  application: { type: "com.atlassian.confluence", name: "Confluence" },
  relationship: "mentioned in",
  object: {
    url: "https://qa.atlassian.net/wiki/spaces/QA/pages/2",
    title: "Übergabe-Checkliste",
    summary: "Ablauf für den Release",
    icon: { url16x16: "https://qa.atlassian.net/icon.png" },
    status: { resolved: true },
  },
};

describe("summarizeRemoteLinks", () => {
  it("übernimmt Titel, Beschreibung, Beziehung, Anwendung und geprüftes Ziel", () => {
    expect(summarizeRemoteLinks([confluence])).toEqual({
      links: [
        {
          id: "10000",
          title: "Übergabe-Checkliste",
          summary: "Ablauf für den Release",
          relationship: "mentioned in",
          application: "Confluence",
          href: "https://qa.atlassian.net/wiki/spaces/QA/pages/2",
          host: "qa.atlassian.net",
          resolved: true,
        },
      ],
      unreadable: 0,
    });
  });

  it("behält Einträge mit unbrauchbarem Ziel als nicht öffnbar", () => {
    const [row] = summarizeRemoteLinks([{ id: 1, object: { title: "Skript", url: "javascript:alert(1)" } }]).links;
    expect(row).toMatchObject({ title: "Skript", href: undefined, host: undefined });
  });

  it("zeigt Einträge ohne Titel, wenn das Ziel gültig ist", () => {
    const [row] = summarizeRemoteLinks([{ id: 2, object: { url: "http://intranet.example/doc" } }]).links;
    expect(row).toMatchObject({ title: undefined, href: "http://intranet.example/doc", host: "intranet.example" });
  });

  it("zählt Einträge ohne Objekt, ohne Titel und Ziel oder mit falschen Typen als unlesbar", () => {
    const result = summarizeRemoteLinks([
      null,
      { id: 3 },
      { id: 4, object: { title: "  ", url: "ftp://files.example" } },
      { id: 5, object: { title: 42, url: "https://example.test" } },
      confluence,
    ]);
    expect(result.links.map(({ id }) => id)).toEqual(["10000"]);
    expect(result.unreadable).toBe(4);
  });

  it("vergibt stabile Ersatz-IDs ohne Jira-ID", () => {
    const result = summarizeRemoteLinks([{ object: { title: "A" } }, { object: { title: "B" } }]);
    expect(result.links.map(({ id }) => id)).toEqual(["index-0", "index-1"]);
  });
});

describe("openableUrl", () => {
  it.each(["https://example.test/a?b=1", "HTTP://Example.test"])("akzeptiert %s", (value) => {
    expect(openableUrl(value)?.href).toMatch(/^https?:\/\/example\.test/);
  });

  it.each([
    undefined,
    null,
    "",
    "example.test",
    "/wiki/page",
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///C:/geheim.txt",
    "mailto:a@example.test",
    "https://user:secret@example.test/",
  ])("lehnt %s ab", (value) => {
    expect(openableUrl(value)).toBeUndefined();
  });
});

describe("remoteLinkKeys", () => {
  it("liegt unter dem Ticket-Key und trennt Instanz und Konto", () => {
    const key = remoteLinkKeys.issue("DEMO-1", "cloud", "user");
    expect(key.slice(0, jiraKeys.issue("DEMO-1").length)).toEqual([...jiraKeys.issue("DEMO-1")]);
    expect(key).not.toEqual(remoteLinkKeys.issue("DEMO-1", "cloud", "other"));
    expect(key).not.toEqual(remoteLinkKeys.issue("DEMO-1", "other", "user"));
  });
});
