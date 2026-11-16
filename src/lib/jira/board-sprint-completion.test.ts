import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import fixture from "../../../tests/jira/fixtures/scrum-completion.json";
import { boardLanes } from "../board-lanes";
import { BoardConfiguration, BoardIssuePage, boardGroups, type BoardData, type BoardMetadata } from "./board";
import { boardSprintCompletion } from "./board-sprint-completion";

const config = Schema.decodeUnknownSync(BoardConfiguration)(fixture.configuration);
const page = Schema.decodeUnknownSync(BoardIssuePage)(fixture.page);
const metadata: BoardMetadata = { config, boardId: 42, boardType: "scrum", sprintField: "customfield_sprint" };

describe("Sprintabschluss aus der Boardkonfiguration", () => {
  it("benennt die rechte konfigurierte Spalte bei mehreren grünen Statusspalten", () => {
    const data: BoardData = { pages: [{ ...page, metadata }], pageParams: [undefined] };
    const groups = boardGroups(data);
    expect(groups[0].columns.slice(1).map((column) => column.issues[0].fields.status.statusCategory.key)).toEqual(["done", "done"]);
    expect(groups[0].columns.at(-1)?.issues.map((issue) => issue.fields.status.statusCategory.key)).toEqual(["done", "indeterminate"]);
    expect(boardSprintCompletion(data.pages[0].metadata)).toEqual({ columnName: "Ausgeliefert", hasStatuses: true });
  });

  it("bleibt bei versteckter rechter Spalte und getrennten Blocker-Lanes unverändert", () => {
    const data: BoardData = { pages: [{ ...page, metadata }], pageParams: [undefined] };
    const columns = boardGroups(data)[0].columns;
    const lanes = boardLanes(columns).map((lane) => ({
      ...lane, columns: lane.columns.filter((column) => column.name !== "Ausgeliefert"),
    }));
    expect(lanes.map((lane) => lane.name)).toEqual(["Beschleunigen", "Alles andere"]);
    expect(lanes.every((lane) => lane.columns.at(-1)?.name === "Fachlich fertig")).toBe(true);
    expect(boardSprintCompletion(data.pages[0].metadata)?.columnName).toBe("Ausgeliefert");
    expect(data.pages[0].metadata.config).toEqual(fixture.configuration);
  });

  it("benennt die konfigurierte Spalte bereits bei leeren oder erst teilweise geladenen Sprints", () => {
    for (const issues of [[], page.issues.slice(0, 1)]) {
      const data: BoardData = { pages: [{ issues, isLast: false, nextPageToken: "next", metadata }], pageParams: [undefined] };
      expect(boardSprintCompletion(data.pages[0].metadata)).toEqual({ columnName: "Ausgeliefert", hasStatuses: true });
    }
  });

  it("ersetzt eine rechte Spalte ohne Statuszuordnung nicht durch die letzte belegte Spalte", () => {
    const emptyRight = { ...metadata, config: { ...config, columnConfig: {
      columns: [...config.columnConfig.columns, { name: "Ohne Zuordnung", statuses: [] }],
    } } };
    expect(boardSprintCompletion(emptyRight)).toEqual({ columnName: "Ohne Zuordnung", hasStatuses: false });
  });

  it("folgt geänderter Reihenfolge und Spaltennamen statt Namen oder Farben zu erraten", () => {
    const reordered = { ...metadata, config: { ...config, columnConfig: {
      columns: [...config.columnConfig.columns].reverse(),
    } } };
    expect(boardSprintCompletion(reordered)).toEqual({ columnName: "In Arbeit", hasStatuses: true });
  });

  it.each(["kanban", "simple", "unknown"])("zeigt keinen Sprintabschluss für Boardtyp %s", (boardType) => {
    expect(boardSprintCompletion({ ...metadata, boardType })).toBeUndefined();
  });

  it("errät bei fehlenden Metadaten oder Spalten keine Abschluss-Spalte", () => {
    expect(boardSprintCompletion()).toBeUndefined();
    expect(boardSprintCompletion({ ...metadata, config: { ...config, columnConfig: { columns: [] } } })).toBeUndefined();
  });
});
