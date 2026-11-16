import { describe, expect, it } from "vitest";
import fixture from "../../../tests/jira/fixtures/issue-time.json";
import { issueTimeSummary } from "./issue-time";

describe("Ticketzeit und von Jira gelieferte Aggregate", () => {
  it("trennt fuer alle drei Kennzahlen eigene Werte von gelieferten Gesamtwerten", () => {
    const rows = issueTimeSummary(fixture.fields);
    expect(rows.map((row) => [row.own.text, row.aggregate.text])).toEqual([["24 h", "48 h"], ["2 h", "5 h"], ["4 h", "10 h"]]);
    expect(rows.map((row) => row.aggregate.source)).toEqual(["aggregatetimeoriginalestimate", "aggregatetimespent", "aggregatetimeestimate"]);
    expect(rows.map((row) => row.own.source)).toEqual(["timeoriginalestimate", "timespent", "timeestimate"]);
  });
  it("bewahrt explizite Nullsekunden trotz anderer Text-/Unteraufgabenwerte", () => {
    const fields = { ...fixture.fields, timeoriginalestimate: 0, timespent: 0, timeestimate: 0, aggregatetimeoriginalestimate: 0, aggregatetimespent: 0, aggregatetimeestimate: 0 };
    expect(issueTimeSummary(fields).every((row) => row.own.text === "0 min" && row.aggregate.text === "0 min" && row.aggregate.state === "known")).toBe(true);
  });
  it.each([undefined, null])("laesst fehlende Aggregate %s trotz eigener Zeiten und sichtbarer Unteraufgaben unbekannt", (value) => {
    const fields = { ...fixture.fields, aggregatetimeoriginalestimate: value, aggregatetimespent: value, aggregatetimeestimate: value };
    const rows = issueTimeSummary(fields);
    expect(rows.map((row) => row.own.text)).toEqual(["24 h", "2 h", "4 h"]);
    expect(rows.every((row) => row.aggregate.state === "missing" && row.aggregate.text === "Unbekannt" && row.aggregate.note === "Nicht geliefert")).toBe(true);
  });
  it("erfindet auch bei partiell gelieferten Aggregaten keine anderen Summen", () => {
    const rows = issueTimeSummary({ timetracking: fixture.fields.timetracking, aggregatetimespent: 18000, subtasks: fixture.fields.subtasks, worklog: fixture.fields.worklog });
    expect(rows.map((row) => row.aggregate.text)).toEqual(["Unbekannt", "5 h", "Unbekannt"]);
  });
  it("nimmt eigene Sekunden aus timetracking als Fallback und behaelt die Herkunft", () => {
    const rows = issueTimeSummary({ timetracking: fixture.fields.timetracking });
    expect(rows.map((row) => row.own.text)).toEqual(["24 h", "2 h", "4 h"]);
    expect(rows[0].own.source).toBe("timetracking.originalEstimateSeconds");
    expect(rows.every((row) => row.aggregate.text === "Unbekannt")).toBe(true);
  });
  it("erhaelt eigene Jira-Textangaben ohne Annahme ueber Arbeitstagslaengen", () => {
    const rows = issueTimeSummary({ timetracking: { originalEstimate: "3d", timeSpent: "0m", remainingEstimate: "1w 2d" } });
    expect(rows.map((row) => row.own.text)).toEqual(["3d", "0m", "1w 2d"]);
    expect(rows.every((row) => row.own.state === "formatted" && row.own.note === "Jira-Textangabe")).toBe(true);
    expect(rows.every((row) => row.aggregate.state === "missing")).toBe(true);
  });
  it("behandelt null und leere Texte nicht als Nullsekunden", () => {
    for (const timetracking of [null, undefined, {}, { originalEstimate: null, timeSpent: "", remainingEstimate: "  " }]) {
      expect(issueTimeSummary({ timetracking }).every((row) => row.own.state === "missing" && row.aggregate.state === "missing")).toBe(true);
    }
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "7200", false, {}])("ersetzt ungueltige Gesamtwerte %j nicht durch eigene oder sichtbare Zeiten", (value) => {
    const rows = issueTimeSummary({ ...fixture.fields, aggregatetimespent: value });
    expect(rows[1].aggregate).toMatchObject({ text: "Unbekannt", state: "invalid", note: "Ungültiger Jira-Wert" });
    expect(rows[0].aggregate.text).toBe("48 h");
  });
  it("kaschiert ungueltige eigene Sekunden nicht durch formatierte Fallbackwerte", () => {
    expect(issueTimeSummary({ ...fixture.fields, timespent: "bad" })[1].own).toMatchObject({ state: "invalid", text: "Unbekannt" });
  });
  it("zeigt gelieferte kleinere Aggregate unveraendert statt sie lokal zu korrigieren", () => {
    const rows = issueTimeSummary({ ...fixture.fields, aggregatetimeoriginalestimate: 3600 });
    expect(rows[0].own.text).toBe("24 h");
    expect(rows[0].aggregate.text).toBe("1 h");
  });
});
