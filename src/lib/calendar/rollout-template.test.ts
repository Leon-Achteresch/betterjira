import { describe, expect, it } from "vitest";
import type { Rollout } from "./model";
import { rolloutDraft, rolloutForm, validateRolloutForm } from "./presentation";
import { COPY_SUFFIX, copyTitle, rolloutTemplateForm } from "./rollout-template";
import { ROLLOUT_TITLE_MAX_LENGTH } from "./validation";

const linked: Rollout = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Produktion Release 2.4",
  start: new Date(2026, 10, 6, 14, 0).toISOString(),
  end: new Date(2026, 10, 6, 15, 30).toISOString(),
  notes: "Monitoring beobachten",
  issues: [{ key: "DEMO-1", summary: "Login" }],
  siteUrl: "https://acme.atlassian.net",
  reminderMinutes: 60,
  outlookEventId: "BEEF1",
  outlookAccountId: "ABC123",
  outlookWebLink: "https://outlook.example/BEEF1",
};

describe("copyTitle", () => {
  it("marks the copy recognisably", () => {
    expect(copyTitle("  Release  ")).toBe("Release (Kopie)");
  });

  it("stays within the title limit", () => {
    const title = copyTitle("x".repeat(ROLLOUT_TITLE_MAX_LENGTH));
    expect(title).toHaveLength(ROLLOUT_TITLE_MAX_LENGTH);
    expect(title.endsWith(COPY_SUFFIX)).toBe(true);
  });

  it("does not split an emoji at the title limit", () => {
    const title = copyTitle("😀".repeat(128));
    expect(title).toBe("😀".repeat(123) + COPY_SUFFIX);
    expect(title.length).toBeLessThanOrEqual(ROLLOUT_TITLE_MAX_LENGTH);
  });
});

describe("rolloutTemplateForm", () => {
  it("keeps content, notes, issues, period and reminder", () => {
    expect(rolloutTemplateForm(linked)).toEqual({ ...rolloutForm(linked), title: "Produktion Release 2.4 (Kopie)" });
  });

  it("carries no identity or Outlook link into the form or the draft", () => {
    const form = rolloutTemplateForm(linked);
    const draft = rolloutDraft(form, linked.siteUrl);
    for (const value of [form, draft]) {
      expect(value).not.toHaveProperty("id");
      expect(JSON.stringify(value)).not.toMatch(/BEEF1|ABC123|outlook|00000000-0000-4000-8000-000000000001/i);
    }
    expect(draft).toEqual({
      title: "Produktion Release 2.4 (Kopie)",
      start: linked.start,
      end: linked.end,
      notes: linked.notes,
      issues: linked.issues,
      siteUrl: linked.siteUrl,
      reminderMinutes: 60,
    });
  });

  it("produces a valid form for a long title", () => {
    expect(validateRolloutForm(rolloutTemplateForm({ ...linked, title: "y".repeat(ROLLOUT_TITLE_MAX_LENGTH) }))).toEqual({});
  });

  it("leaves the original untouched when the copy is edited", () => {
    const original = structuredClone(linked);
    const form = rolloutTemplateForm(linked);
    Object.assign(form.issues[0], { summary: "Anders" });
    Object.assign(form, { title: "Geändert", notes: "neu" });
    expect(linked).toEqual(original);
    expect(linked.issues[0].summary).toBe("Login");
  });
});
