import { Link } from "@tanstack/react-router";
import { FieldValue } from "@/components/issue-fields";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { isAdfDoc } from "@/lib/jira/adf";
import { fieldText } from "@/lib/jira/field-text";
import { KEY_COLUMN } from "@/lib/jira/issue-view";
import type { SearchIssue } from "@/lib/jira/search";

type Status = { name: string; statusCategory: { colorName: string } };

const isStatus = (value: unknown): value is Status =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Status).name === "string" &&
  typeof (value as Status).statusCategory?.colorName === "string";

const iconOf = (value: unknown) => {
  const { iconUrl, name } = (typeof value === "object" && value !== null ? value : {}) as { iconUrl?: unknown; name?: unknown };
  return typeof iconUrl === "string" && typeof name === "string" ? { iconUrl, name } : undefined;
};

export function IssueCell({ issue, column }: { issue: SearchIssue; column: string }) {
  const value = issue.fields[column];
  if (column === KEY_COLUMN) return <span className="font-mono text-muted-foreground">{issue.key}</span>;
  if (column === "summary") {
    return (
      <Link
        to="/issue/$key"
        params={{ key: issue.key }}
        className="block max-w-[32rem] truncate outline-none after:absolute after:inset-0 focus-visible:underline"
      >
        {typeof value === "string" ? value : issue.key}
      </Link>
    );
  }
  if (column === "status" && isStatus(value)) {
    return <IssueStatusMenu issueKey={issue.key} status={value} className="relative z-10" />;
  }
  const icon = iconOf(value);
  if (icon) {
    return (
      <span className="flex items-center gap-1.5">
        <img src={icon.iconUrl} alt="" className="size-4 shrink-0" />
        {icon.name}
      </span>
    );
  }
  if (isAdfDoc(value)) return <span className="block max-w-80 truncate text-muted-foreground">{fieldText(value) || "–"}</span>;
  return (
    <span className="block max-w-72 truncate" title={fieldText(value) || undefined}>
      <FieldValue value={value} />
    </span>
  );
}
