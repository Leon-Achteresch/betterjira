import { describe, expect, it } from "vitest";
import { todayAgenda, type AgendaInput } from "./today-agenda";

const now = new Date(2026, 10, 9, 16, 0);
const issue = (key: string, updated: Date, duedate?: string) => ({ key, fields: { summary: `Ticket ${key}`, updated: updated.toISOString(), duedate } });
const empty: AgendaInput = { now, directUnread: 0, rollouts: [], loggedSeconds: null, active: [], open: [] };

describe("todayAgenda", () => {
  it("bleibt ohne Anlass leer", () => {
    expect(todayAgenda(empty)).toEqual([]);
  });

  it("stellt Dringendes vor Hinweise", () => {
    const items = todayAgenda({
      ...empty,
      directUnread: 2,
      loggedSeconds: 0,
      rollouts: [{ title: "Release 1.2", start: new Date(2026, 10, 9, 18, 30).toISOString() }],
      active: [issue("A-1", new Date(2026, 10, 1))],
      open: [issue("A-2", now, "2026-11-08")],
    });
    expect(items.map((item) => [item.id, item.tone])).toEqual([
      ["inbox", "urgent"],
      ["due", "urgent"],
      ["time", "urgent"],
      ["rollout", "normal"],
      ["stale", "normal"],
    ]);
    expect(items[0]!.title).toBe("2 Rückmeldungen an dich");
    expect(items[1]!.title).toBe("A-2 ist überfällig");
    expect(items[3]!.title).toBe("Rollout um 18:30");
  });

  it("ignoriert Rollouts anderer Tage, frische Tickets und Wochenenden", () => {
    const saturday = new Date(2026, 10, 14, 17, 0);
    const items = todayAgenda({
      ...empty,
      now: saturday,
      loggedSeconds: 0,
      rollouts: [{ title: "Morgen", start: new Date(2026, 10, 15, 9).toISOString() }],
      active: [issue("A-1", new Date(2026, 10, 13))],
      open: [issue("A-2", saturday, "2026-11-20")],
    });
    expect(items).toEqual([]);
  });

  it("liest Fälligkeitsdaten als lokalen Kalendertag", () => {
    const due = (duedate: string) => todayAgenda({ ...empty, open: [issue("A-1", now, duedate)] }).map((item) => item.title);
    expect(due("2026-11-09")).toEqual(["A-1 ist heute fällig"]);
    expect(due("2026-11-10")).toEqual([]);
  });

  it("zeigt gebuchte Zeit als ruhigen Hinweis", () => {
    expect(todayAgenda({ ...empty, loggedSeconds: 9000 })).toMatchObject([{ id: "time", tone: "normal", title: "2,5 h heute gebucht" }]);
  });
});
