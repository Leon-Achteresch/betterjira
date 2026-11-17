import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { descriptionSource } from "@/lib/description-comparison";

const capture = vi.hoisted(() => ({ buttons: [] as ComponentProps<"button">[], checks: [] as { checked?: boolean }[] }));
vi.mock("@/components/ui/button", () => ({ Button: ({ variant: _variant, size: _size, ...props }: ComponentProps<"button"> & { variant?: string; size?: string }) => { capture.buttons.push(props); return <button {...props} />; } }));
vi.mock("@/components/ui/checkbox", () => ({ Checkbox: (props: { checked?: boolean }) => { capture.checks.push(props); return <input type="checkbox" readOnly checked={props.checked} />; } }));
const { DescriptionComparisonPanel } = await import("./description-comparison-panel");

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

describe("descriptionSource", () => {
  it("erhaelt Rohtext exakt und liefert fuer leere oder fehlende Fassung keinen Quelltext", () => {
    expect(descriptionSource(undefined)).toBeUndefined();
    expect(descriptionSource({ version: 1, format: "wiki", value: null })).toBeUndefined();
    expect(descriptionSource({ version: 1, format: "wiki", value: " a\n\tb " })).toBe(" a\n\tb ");
  });
});
