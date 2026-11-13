import { Schema } from "effect";
import type { IssueView } from "@/lib/jira/issue-view";
import { IssueViewSchema } from "@/lib/view-preferences";

const ViewTransfer = Schema.Struct({
  format: Schema.Literal("betterjira.issue-view"),
  version: Schema.Literal(1),
  view: IssueViewSchema,
});

export function serializeIssueView(view: IssueView): string {
  return JSON.stringify({ format: "betterjira.issue-view", version: 1, view: Schema.decodeUnknownSync(IssueViewSchema)(view) }, null, 2);
}

export function parseIssueView(source: string): { ok: true; view: IssueView } | { ok: false; error: string } {
  if (source.length > 65_536) return { ok: false, error: "Die Ansicht ist zu groß. Maximal 64 KB sind erlaubt." };
  try {
    const { view } = Schema.decodeUnknownSync(ViewTransfer)(JSON.parse(source));
    if (view.columns.length === 0 || view.columns.length > 80 || new Set(view.columns).size !== view.columns.length) {
      return { ok: false, error: "Die Ansicht muss 1 bis 80 unterschiedliche Spalten enthalten." };
    }
    return { ok: true, view };
  } catch {
    return { ok: false, error: "Das ist keine unterstützte BetterJira-Ansicht. Kopiere die vollständige JSON-Definition aus dem Ansichtsmenü." };
  }
}
