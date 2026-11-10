import { describe, expect, it } from "vitest";
import type { Rollout } from "./model";
import {
  emptyRolloutForm,
  externalEvents,
  issueSearchJql,
  itemsOn,
  localInstant,
  monthGrid,
  opensInternally,
  outlookLinkState,
  rolloutDraft,
  rolloutForm,
  shiftEnd,
  toggleIssue,
  upcomingRollouts,
  validateRolloutForm,
} from "./presentation";

const rollout = (patch: Partial<Rollout> = {}): Rollout => ({
  id: "r1",
  title: "Release",
  start: new Date(2026, 10, 6, 10, 0).toISOString(),
  end: new Date(2026, 10, 6, 11, 0).toISOString(),
  notes: "",
  issues: [],
  siteUrl: "https://acme.atlassian.net",
  reminderMinutes: 15,
  outlookEventId: null,
  outlookAccountId: null,
  outlookWebLink: null,
  ...patch,
});

describe("monthGrid", () => {
  it("starts on Monday and ends on Sunday", () => {
    const days = monthGrid(new Date(2026, 10, 1));
    expect(days[0].getDay()).toBe(1);
    expect(days[days.length - 1].getDay()).toBe(0);
    expect(days.length % 7).toBe(0);
    expect(days[0]).toEqual(new Date(2026, 9, 26));
  });
});

describe("itemsOn", () => {
  it("treats midnight ends as exclusive, including all-day Outlook events", () => {
    const item = rollout({ start: new Date(2026, 10, 5, 0).toISOString(), end: new Date(2026, 10, 6, 0).toISOString() });
    expect(itemsOn([item], new Date(2026, 10, 5))).toHaveLength(1);
    expect(itemsOn([item], new Date(2026, 10, 6))).toEqual([]);
  });
  it("includes multi-day rollouts on every covered day, sorted by start", () => {
    const long = rollout({ id: "long", start: new Date(2026, 10, 5, 22).toISOString(), end: new Date(2026, 10, 7, 2).toISOString() });
    const short = rollout();
    expect(itemsOn([short, long], new Date(2026, 10, 6)).map((item) => item.id)).toEqual(["long", "r1"]);
    expect(itemsOn([short, long], new Date(2026, 10, 7)).map((item) => item.id)).toEqual(["long"]);
    expect(itemsOn([short, long], new Date(2026, 10, 8))).toEqual([]);
  });
});

describe("upcomingRollouts", () => {
  it("drops finished rollouts and keeps running ones", () => {
    const past = rollout({ id: "past", end: new Date(2026, 10, 6, 9).toISOString(), start: new Date(2026, 10, 6, 8).toISOString() });
    const running = rollout({ id: "running" });
    expect(upcomingRollouts([running, past], new Date(2026, 10, 6, 10, 30)).map((item) => item.id)).toEqual(["running"]);
  });
});

describe("rollout form", () => {
  const valid = { ...emptyRolloutForm(new Date(2026, 10, 10), new Date(2026, 10, 6, 8)), title: "  Release 2.4 " };

  it("defaults a future day to 09:00 – 10:00", () => {
    expect([valid.startDate, valid.startTime, valid.endDate, valid.endTime]).toEqual(["2026-11-10", "09:00", "2026-11-10", "10:00"]);
  });

  it("requires a title and an end after the start", () => {
    expect(validateRolloutForm({ ...valid, title: " " }).title).toBeDefined();
    expect(validateRolloutForm({ ...valid, endTime: "09:00" }).end).toBe("Das Ende muss nach dem Beginn liegen.");
    expect(validateRolloutForm({ ...valid, startTime: "" }).start).toBeDefined();
    expect(validateRolloutForm(valid)).toEqual({});
  });

  it("builds a draft with ISO instants from local time", () => {
    const draft = rolloutDraft(valid, "https://acme.atlassian.net");
    expect(draft?.title).toBe("Release 2.4");
    expect(draft?.start).toBe(new Date(2026, 10, 10, 9).toISOString());
    expect(draft?.end).toBe(new Date(2026, 10, 10, 10).toISOString());
    expect(rolloutDraft({ ...valid, title: "" }, "")).toBeNull();
  });

  it("round-trips a stored rollout", () => {
    const form = rolloutForm(rollout());
    expect(rolloutDraft(form, "x")?.start).toBe(rollout().start);
  });

  it("moves the end along with the start", () => {
    const moved = shiftEnd(valid, "2026-11-11", "23:30");
    expect([moved.endDate, moved.endTime]).toEqual(["2026-11-12", "00:30"]);
  });

  it("rejects incomplete local instants", () => {
    expect(localInstant("2026-11-10", "")).toBeNull();
    expect(localInstant("2026-02-31", "09:00")).toBeNull();
    expect(localInstant("2026-11-10", "25:00")).toBeNull();
    expect(localInstant("2026-1-1", "9:00")).toBeNull();
  });
});

describe("toggleIssue", () => {
  it("adds and removes by key", () => {
    const issue = { key: "ABC-1", summary: "Login" };
    expect(toggleIssue([], issue)).toEqual([issue]);
    expect(toggleIssue([issue], { key: "ABC-1", summary: "" })).toEqual([]);
  });
});

describe("issueSearchJql", () => {
  it("uses history, key and text search", () => {
    expect(issueSearchJql(" ")).toContain("issueHistory()");
    expect(issueSearchJql("abc-12")).toBe('key = "ABC-12"');
    expect(issueSearchJql('say "hi"')).toBe('text ~ "say \\"hi\\"*" ORDER BY updated DESC');
  });
});

describe("outlook link state", () => {
  const account = { id: "store-1", displayName: "Kalender", email: "a@b.de" };
  it("distinguishes local, linked, disconnected and foreign calendars", () => {
    expect(outlookLinkState(rollout(), account)).toBe("local");
    expect(outlookLinkState(rollout({ outlookEventId: "e", outlookAccountId: "store-1" }), account)).toBe("linked");
    expect(outlookLinkState(rollout({ outlookEventId: "e", outlookAccountId: "store-1" }), null)).toBe("disconnected");
    expect(outlookLinkState(rollout({ outlookEventId: "e", outlookAccountId: "store-2" }), account)).toBe("other-account");
  });

  it("hides Outlook events that mirror a rollout", () => {
    const events = [
      { id: "e", title: "Release", start: "", end: "", webLink: "", isAllDay: false },
      { id: "x", title: "Meeting", start: "", end: "", webLink: "", isAllDay: false },
    ];
    expect(externalEvents(events, [rollout({ outlookEventId: "e" })]).map((event) => event.id)).toEqual(["x"]);
  });
});

describe("opensInternally", () => {
  it("opens in-app only for the current Jira site", () => {
    expect(opensInternally("https://acme.atlassian.net", "https://acme.atlassian.net")).toBe(true);
    expect(opensInternally("https://other.atlassian.net", "https://acme.atlassian.net")).toBe(false);
    expect(opensInternally("https://acme.atlassian.net", undefined)).toBe(false);
  });
});
