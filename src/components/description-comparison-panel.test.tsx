import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { descriptionSource } from "@/lib/description-comparison";

const capture = vi.hoisted(() => ({ buttons: [] as ComponentProps<"button">[], checks: [] as { checked?: boolean }[] }));
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
vi.mock("@/components/ui/checkbox", () => ({ Checkbox: (props: { checked?: boolean }) => { capture.checks.push(props); return <input type="checkbox" readOnly checked={props.checked} />; } }));
const { DescriptionComparisonPanel, DescriptionPreview } = await import("./description-comparison-panel");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { IssueMediaContext } = await import("@/hooks/jira/use-issue-media");
const { jiraKeys } = await import("@/lib/jira/keys");

const WIKI = "h1. Titel\n\n  eingerückt  \n|| a || b ||";
const R = descriptionSource({ version: 1, format: "wiki", value: WIKI });
const BASE = descriptionSource({ version: 1, format: "wiki", value: "h1. Titel" });
const decode = (markup: string) => markup.replaceAll("&amp;", "&").replaceAll("&quot;", "\"").replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");

beforeEach(() => { capture.buttons.length = 0; capture.checks.length = 0; });

describe("DescriptionComparisonPanel", () => {
  it("zeigt Jira-Rohfassung und Basis exakt und bestaetigt nie ohne Pruefung oder per Formular-Submit", () => {
    const onConfirm = vi.fn();
    const markup = renderToStaticMarkup(<DescriptionComparisonPanel status="conflict" remote={R} basis={BASE} pending={false} onConfirm={onConfirm} />);
    expect(markup).toContain(`>${WIKI}</pre>`);
    expect(markup).toContain(">h1. Titel</pre>");
    expect(markup).toContain("Beschreibung wurde in Jira geändert");
    const confirm = capture.buttons.find((button) => button.onClick === onConfirm);
    expect(confirm?.type).toBe("button");
    expect(confirm?.disabled).toBe(true);
    expect(capture.checks[0]?.checked).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("markiert fehlende Basis bei unbased und erhaelt ADF-Struktur samt Medien als Quelle", () => {
    const adf = { type: "doc", version: 1, content: [{ type: "mediaSingle", content: [{ type: "media", attrs: { id: "m1", type: "file", collection: "" } }] }, { type: "paragraph", content: [{ type: "mention", attrs: { id: "u1", text: "@Ada" } }] }] };
    const markup = decode(renderToStaticMarkup(<DescriptionComparisonPanel status="unbased" remote={descriptionSource({ version: 1, format: "adf", value: adf })} basis={undefined} pending={false} onConfirm={() => {}} />));
    expect(markup).toContain("Für diesen Entwurf nicht gespeichert.");
    expect(markup).toContain("Ursprüngliche Fassung fehlt");
    const source = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(markup)?.[1] ?? "";
    expect(JSON.parse(source)).toEqual(adf);
  });

  it("sperrt die Bestaetigung waehrend laufender Writes", () => {
    renderToStaticMarkup(<DescriptionComparisonPanel status="conflict" remote={R} basis={BASE} pending onConfirm={() => {}} />);
    expect(capture.buttons.every((button) => button.disabled)).toBe(true);
  });
});

describe("lesbare ADF-Vorschau neben unveraenderter Quelle", () => {
  it("zeigt standardmaessig die Vorschau, haelt die Quelle als Tab erreichbar und bietet Uebernahme nur explizit an", () => {
    const onAdopt = vi.fn();
    const markup = renderToStaticMarkup(<DescriptionComparisonPanel status="conflict" remote={R} basis={BASE} remotePreview={<p>Vorschau R</p>} basisPreview={<p>Vorschau A</p>} pending={false} onConfirm={() => {}} onAdopt={onAdopt} />);
    expect(markup).toMatch(/role="tab"[^>]*>Vorschau</);
    expect(markup).toMatch(/role="tab"[^>]*>Quelle</);
    expect(markup).toMatch(/role="region" aria-label="Aktuell in Jira"[^>]*><p>Vorschau R<\/p>/);
    expect(markup).toContain("<p>Vorschau A</p>");
    expect(markup).not.toContain("</pre>");
    const adopt = capture.buttons.find((button) => button.onClick === onAdopt);
    expect(adopt?.type).toBe("button");
    expect(adopt?.disabled).toBe(false);
    expect(onAdopt).not.toHaveBeenCalled();
  });

  it("zeigt ohne Uebernahmeangebot keinen Uebernahmeknopf und sperrt ihn waehrend Writes", () => {
    renderToStaticMarkup(<DescriptionComparisonPanel status="conflict" remote={R} basis={BASE} pending={false} onConfirm={() => {}} />);
    expect(capture.buttons.some((button) => String(button.children).includes("übernehmen"))).toBe(false);
    capture.buttons.length = 0;
    const onAdopt = vi.fn();
    renderToStaticMarkup(<DescriptionComparisonPanel status="conflict" remote={R} basis={BASE} pending onConfirm={() => {}} onAdopt={onAdopt} />);
    expect(capture.buttons.find((button) => button.onClick === onAdopt)?.disabled).toBe(true);
  });

  it("rendert Mentions, Tabellen und bekannte Medien der Remotefassung ohne gerenderte HTML-Altfassung", () => {
    const client = new QueryClient();
    const pdf = { id: "501", filename: "Angebot.pdf", mimeType: "application/pdf", size: 10, created: "2026-11-01T00:00:00Z" };
    client.setQueryData(jiraKeys.attachmentMediaId(pdf.id), "media-known");
    const doc = { type: "doc", version: 1, content: [
      { type: "paragraph", content: [{ type: "text", text: "Hallo " }, { type: "mention", attrs: { id: "u1", text: "@Ada" } }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Zelle R" }] }] }] }] },
      { type: "paragraph", content: [{ type: "mediaInline", attrs: { id: "media-known", type: "file", collection: "" } }, { type: "mediaInline", attrs: { id: "media-neu", type: "file", collection: "", alt: "Angebot.pdf" } }] },
    ] };
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <IssueMediaContext.Provider value={{ attachments: [pdf], open: () => {} }}>
          <DescriptionPreview doc={doc} mediaSource={{ doc: undefined, rendered: undefined }} />
        </IssueMediaContext.Provider>
      </QueryClientProvider>,
    );
    expect(markup).toContain("@Ada");
    expect(markup).toMatch(/<td[^>]*>.*Zelle R/);
    expect(markup.match(/data-attachment-id="501"/g)).toHaveLength(1);
    expect(markup).toContain("Anhang nicht verfügbar");
    expect(markup).toContain("Angebot.pdf");
  });

  it("zeigt leere Fassung als leer statt als fremdes HTML", () => {
    const markup = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><DescriptionPreview doc={null} mediaSource={undefined} /></QueryClientProvider>);
    expect(markup).toContain(">Leer</p>");
  });
});

describe("descriptionSource", () => {
  it("erhaelt Rohtext exakt und liefert fuer leere oder fehlende Fassung keinen Quelltext", () => {
    expect(descriptionSource(undefined)).toBeUndefined();
    expect(descriptionSource({ version: 1, format: "wiki", value: null })).toBeUndefined();
    expect(descriptionSource({ version: 1, format: "wiki", value: " a\n\tb " })).toBe(" a\n\tb ");
  });
});
