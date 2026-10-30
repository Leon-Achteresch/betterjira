import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";

type AdfMark = { type: string; attrs?: Record<string, unknown> };
type AdfNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: AdfMark[]; content?: AdfNode[] };

const isNode = (value: unknown): value is AdfNode =>
  typeof value === "object" && value !== null && typeof (value as AdfNode).type === "string";

export const safeUrl = (value: unknown) => (typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined);

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        void openUrl(href);
      }}
      title={href}
      className={cn("text-info underline underline-offset-2", className)}
    >
      {children}
    </a>
  );
}

function renderText(node: AdfNode, key: number) {
  return (node.marks ?? []).reduce<ReactNode>((child, mark) => {
    switch (mark.type) {
      case "strong":
        return <strong>{child}</strong>;
      case "em":
        return <em>{child}</em>;
      case "underline":
        return <u>{child}</u>;
      case "strike":
        return <s>{child}</s>;
      case "code":
        return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{child}</code>;
      case "link": {
        const href = safeUrl(mark.attrs?.href);
        return href ? <ExternalLink href={href}>{child}</ExternalLink> : child;
      }
      default:
        return child;
    }
  }, <span key={key}>{node.text}</span>);
}

function renderNodes(nodes: unknown) {
  return Array.isArray(nodes) ? nodes.filter(isNode).map(renderNode) : null;
}

function renderNode(node: AdfNode, key: number): ReactNode {
  const children = renderNodes(node.content);
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "doc":
      return <div key={key}>{children}</div>;
    case "text":
      return renderText(node, key);
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      const level = Math.min(Math.max(Number(attrs.level) || 3, 1), 6);
      const Tag = `h${level}` as "h1";
      return (
        <Tag key={key} className={cn("font-semibold", level <= 2 ? "text-lg" : "text-base")}>
          {children}
        </Tag>
      );
    }
    case "bulletList":
      return <ul key={key} className="list-disc pl-6">{children}</ul>;
    case "orderedList":
      return <ol key={key} className="list-decimal pl-6">{children}</ol>;
    case "taskList":
      return <ul key={key} className="pl-1">{children}</ul>;
    case "taskItem":
      return (
        <li key={key} className="flex items-baseline gap-2">
          <input type="checkbox" checked={attrs.state === "DONE"} readOnly aria-readonly />
          <span>{children}</span>
        </li>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key} className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>;
    case "panel":
      return <div key={key} className="rounded-md bg-muted p-3">{children}</div>;
    case "codeBlock":
      return (
        <pre key={key} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          <code>{children}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "mention":
      return <span key={key} className="rounded bg-muted px-1 font-medium">{String(attrs.text ?? "@?")}</span>;
    case "emoji":
      return <span key={key}>{String(attrs.text ?? attrs.shortName ?? "")}</span>;
    case "status":
      return <span key={key} className="rounded bg-muted px-1 text-xs font-medium uppercase">{String(attrs.text ?? "")}</span>;
    case "date":
      return <span key={key}>{new Date(Number(attrs.timestamp)).toLocaleDateString("de-DE")}</span>;
    case "inlineCard":
    case "blockCard": {
      const href = safeUrl(attrs.url);
      return href ? <ExternalLink key={key} href={href}>{href}</ExternalLink> : null;
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children}</tr>;
    case "tableHeader":
      return <th key={key} className="border px-2 py-1 text-left font-medium">{children}</th>;
    case "tableCell":
      return <td key={key} className="border px-2 py-1">{children}</td>;
    case "mediaSingle":
    case "mediaGroup":
      return <p key={key} className="text-sm text-muted-foreground italic">[Anhang]</p>;
    default:
      return children ? <div key={key}>{children}</div> : null;
  }
}

export function AdfContent({ doc, className }: { doc: unknown; className?: string }) {
  if (!isNode(doc)) return null;
  return <div className={cn("flex min-w-0 flex-col gap-3 text-sm leading-relaxed wrap-anywhere [&_li>p]:inline [&_p]:min-h-[1lh]", className)}>{renderNodes(doc.content)}</div>;
}

export function AdfNodeView({ node }: { node: unknown }) {
  return isNode(node) ? renderNode(node, 0) : null;
}
