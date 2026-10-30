import { describe, expect, it } from "vitest";
import { toContextIssue } from "./context";

const me = { accountId: "me", displayName: "Leon" };
const input = { runId: "r1", siteUrl: "https://acme.atlassian.net", me };
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("toContextIssue", () => {
  it("flattens fields, marks my comments and keeps only recent ones", () => {
    const issue = toContextIssue(
      {
        key: "ABC-1",
        fields: {
          summary: "Login kaputt",
          created: "2026-10-01",
          updated: "2026-10-29",
          project: { key: "ABC", name: "Acme" },
          status: { name: "In Arbeit", statusCategory: { key: "indeterminate" } },
          reporter: { accountId: "me", displayName: "Leon" },
          description: doc("x".repeat(900)),
          comment: {
            total: 5,
            comments: ["a", "b", "c", "d", "e"].map((text, i) => ({
              author: { accountId: i === 4 ? "anna" : "me", displayName: i === 4 ? "Anna" : "Leon" },
              created: `2026-10-2${i}`,
              body: doc(text),
            })),
          },
        },
      },
      input,
    );
    expect(issue.url).toBe("https://acme.atlassian.net/browse/ABC-1");
    expect(issue.myRelation).toBe("reporter");
    expect(issue.description).toHaveLength(801);
    expect(issue.recentComments.map((c) => c.text)).toEqual(["b", "c", "d", "e"]);
    expect(issue.recentComments.at(-1)).toMatchObject({ author: "Anna", byMe: false });
  });
});
