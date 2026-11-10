import { describe, expect, it } from "vitest";
import { helpdeskReferences } from "./jira-links";
import { normalizeBaseUrl, ticketQuery } from "./presentation";

const names = {
  customfield_1: "Helpdesk Ticketnummer",
  customfield_2: "Helpdesk Ticket",
  customfield_3: "Andere Nummer",
};
const base = "https://helpdesk.example.com";

describe("Jira Helpdesk references", () => {
  it("joins the screenshot's number and link fields into one reference", () => {
    expect(
      helpdeskReferences(
        {
          customfield_1: "20043776",
          customfield_2:
            "[common solutions Helpdesk|https://helpdesk.example.com/#ticket/zoom/41]",
          customfield_3: "99999",
        },
        names,
        base,
      ),
    ).toEqual([{ number: "20043776", id: 41, url: `${base}/#ticket/zoom/41` }]);
  });
  it("supports numeric, array, option and ADF custom field values and deduplicates numbers", () => {
    expect(
      helpdeskReferences(
        {
          customfield_1: [
            20043776,
            { value: "20043777" },
            { content: [{ text: "20043776" }] },
          ],
        },
        names,
      ),
    ).toEqual([{ number: "20043776" }, { number: "20043777" }]);
  });
  it("does not infer local API IDs from foreign hosts or paths", () => {
    expect(
      helpdeskReferences(
        { customfield_2: "https://evil.example.com/#ticket/zoom/41" },
        names,
        base,
      )[0].id,
    ).toBeUndefined();
    expect(
      helpdeskReferences(
        { customfield_2: `${base}/other/#ticket/zoom/41` },
        names,
        `${base}/zammad`,
      )[0].id,
    ).toBeUndefined();
  });
  it("ignores unsafe links and non-helpdesk Jira fields", () => {
    expect(
      helpdeskReferences(
        { customfield_2: "javascript:alert(1)", customfield_3: "20043776" },
        names,
        base,
      ),
    ).toEqual([]);
    expect(
      helpdeskReferences(
        {
          customfield_2:
            "https://user:password@helpdesk.example.com/#ticket/zoom/41",
        },
        names,
        base,
      ),
    ).toEqual([]);
  });
  it("recognizes alternate helpdesk names without hardcoded custom field IDs", () => {
    expect(
      helpdeskReferences({ x: "20043776" }, { x: "Zammad Ticket-Nummer" }),
    ).toEqual([{ number: "20043776" }]);
    expect(
      helpdeskReferences({ x: "20043776" }, { x: "Hilft das Ticket-Nummer" }),
    ).toEqual([{ number: "20043776" }]);
  });
});

describe("connection and search input", () => {
  it("normalizes the API root and rejects insecure or credentialed addresses", () => {
    expect(normalizeBaseUrl(`${base}/api/v1/`)).toBe(base);
    for (const value of [
      "invalid",
      "http://example.com",
      "https://user:pass@example.com",
      `${base}?token=x`,
      `${base}/#ticket/zoom/41`,
    ])
      expect(normalizeBaseUrl(value)).toBeNull();
  });
  it("combines filters and number searches without confusing IDs", () => {
    expect(ticketQuery("#20043776", "all")).toBe("number:20043776");
    expect(ticketQuery("", "mine", 3)).toContain("owner_id:3");
    expect(ticketQuery("", "all")).toBe("*");
  });
});
