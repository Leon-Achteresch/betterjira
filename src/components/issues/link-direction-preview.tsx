import { ArrowLeftRightIcon } from "lucide-react";
import { useLinkDirectionPreview } from "@/hooks/jira/use-link-direction-preview";
import type { IssueLinkPreviewContext } from "@/hooks/jira/use-issue-link-preview";
import type { IssueLinkReference } from "@/lib/jira/issue-links";
import type { LinkDirectionPreview } from "@/lib/jira/link-direction-preview";
import { IssueLinkPreviewPopover } from "./issue-link-preview-popover";

function Directions({
  title,
  relations,
}: {
  title: string;
  relations: LinkDirectionPreview["current"];
}) {
  return (
    <section
      aria-label={title}
      className="space-y-1 rounded-xl border border-border/60 px-3 py-2"
    >
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1 text-sm">
        {relations.map(({ from, label, to }) => (
          <li key={from} className="wrap-anywhere">
            <span className="font-medium tabular-nums">{from}</span> {label}{" "}
            <span className="font-medium tabular-nums">{to}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LinkDirectionPreviewAction({
  context,
  target,
  reference,
}: {
  context: IssueLinkPreviewContext;
  target: string;
  reference: IssueLinkReference;
}) {
  const preview = useLinkDirectionPreview(context, target, reference);
  return (
    <IssueLinkPreviewPopover
      title="Linkrichtung prüfen"
      triggerLabel={`Richtung der Verknüpfung zu ${target} prüfen`}
      icon={<ArrowLeftRightIcon aria-hidden />}
      preview={preview}
    >
      {preview.result && (
        <div className="space-y-2">
          <p className="px-2 text-xs text-muted-foreground wrap-anywhere">
            Linktyp{" "}
            <span className="font-medium text-foreground">
              {preview.result.typeName}
            </span>{" "}
            <span className="tabular-nums">({preview.result.typeId})</span>
          </p>
          <Directions title="Aktuell" relations={preview.result.current} />
          <Directions
            title="Umgekehrte Richtung"
            relations={preview.result.reversed}
          />
        </div>
      )}
    </IssueLinkPreviewPopover>
  );
}
