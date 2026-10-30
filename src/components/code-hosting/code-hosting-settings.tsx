import type { ComponentProps, ReactNode } from "react";
import { AddConnectionDialog } from "./add-connection-dialog";
import { ConnectionList } from "./connection-list";
import { RepoLinks } from "./repo-links";

function SettingsBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function CodeHostingSettings({
  connections,
  addDialog,
  repoLinks,
}: {
  connections: ComponentProps<typeof ConnectionList>;
  addDialog: ComponentProps<typeof AddConnectionDialog>;
  repoLinks: ComponentProps<typeof RepoLinks>;
}) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-10">
      <SettingsBlock
        title="Verbindungen"
        description="GitHub und GitHub Enterprise kommen automatisch aus der GitHub CLI. Bitbucket verbindest du per Token."
      >
        <ConnectionList {...connections} />
        <AddConnectionDialog {...addDialog} />
      </SettingsBlock>
      <SettingsBlock
        title="Repositories je Bereich"
        description="In diesen Repositories sucht betterjira nach Branches und Pull Requests zum Issue-Key."
      >
        <RepoLinks {...repoLinks} />
      </SettingsBlock>
    </div>
  );
}
