import { GitCompareArrowsIcon } from "lucide-react";
import { useDuplicateComparison } from "@/hooks/jira/use-duplicate-comparison";
import type { IssueLinkPreviewContext } from "@/hooks/jira/use-issue-link-preview";
import type { DuplicateComparison } from "@/lib/jira/duplicate-comparison";
import type { IssueLinkReference } from "@/lib/jira/issue-links";
import { IssueLinkPreviewPopover } from "./issue-link-preview-popover";

const fields = [
  ["summary", "Titel"],
  ["status", "Status"],
  ["issueType", "Typ"],
  ["priority", "Priorität"],
] as const;

function ComparisonTable({ duplicate, original }: DuplicateComparison) {
  return (
    <table className="w-full table-fixed text-left text-xs">
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="w-[24%] p-2">
            <span className="sr-only">Feld</span>
          </th>
          <th scope="col" className="p-2 align-top wrap-anywhere">
            <span className="block font-normal text-muted-foreground">
              Duplikat
            </span>
            <span className="tabular-nums">{duplicate.key}</span>
          </th>
          <th scope="col" className="p-2 align-top wrap-anywhere">
            <span className="block font-normal text-muted-foreground">
              Ursprung laut Link
            </span>
            <span className="tabular-nums">{original.key}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map(([field, label]) => (
          <tr
            key={field}
            className="border-b border-border/60 align-top last:border-0"
          >
            <th scope="row" className="p-2 font-medium text-muted-foreground">
              {label}
            </th>
            {[duplicate, original].map((ticket) => (
              <td key={ticket.key} className="p-2 wrap-anywhere">
                {ticket[field] ?? (
                  <span className="text-muted-foreground">Nicht verfügbar</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DuplicateComparisonAction({
  context,
  target,
  reference,
}: {
  context: IssueLinkPreviewContext;
  target: string;
  reference: IssueLinkReference;
}) {
  const comparison = useDuplicateComparison(context, target, reference);
  return (
    <IssueLinkPreviewPopover
      title="Duplikat vergleichen"
      triggerLabel={`Duplikatlink zu ${target} vergleichen`}
      icon={<GitCompareArrowsIcon aria-hidden />}
      preview={comparison}
    >
      {comparison.result && <ComparisonTable {...comparison.result} />}
    </IssueLinkPreviewPopover>
  );
}
