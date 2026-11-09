import type { ComponentType, SVGProps } from "react";
import type { ReactNode } from "react";
import type { StatusLabel } from "@/lib/connections/status";
import { StatusBadge } from "./status-badge";

type ConnectionCardProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  status: StatusLabel;
  children: ReactNode;
  actions?: ReactNode;
};

export function ConnectionCard({ icon: Icon, title, status, children, actions }: ConnectionCardProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 font-medium text-balance">{title}</h3>
        <StatusBadge status={status} />
      </header>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}
