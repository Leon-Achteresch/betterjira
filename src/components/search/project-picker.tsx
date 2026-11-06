import { FolderSearchIcon } from "lucide-react";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import type { JiraProject } from "@/lib/jira/queries";

const ALL = "*";

export function ProjectPicker({
  projects,
  value,
  pending,
  onChange,
}: {
  projects: readonly JiraProject[];
  value?: string;
  pending: boolean;
  onChange: (key: string | undefined) => void;
}) {
  const byKey = new Map(projects.map((project) => [project.key, project]));
  const label = (key: string) => (key === ALL ? "Alle Projekte" : (byKey.get(key)?.name ?? key));

  return (
    <Combobox
      items={[ALL, ...projects.map((project) => project.key)]}
      value={value ?? ALL}
      itemToStringLabel={label}
      onValueChange={(key) => onChange(key && key !== ALL ? key : undefined)}
    >
      <ComboboxInput aria-label="Projekt" placeholder={pending ? "Projekte werden geladen…" : "Projekt suchen"} className="h-8 w-full sm:w-64">
        <InputGroupAddon>
          <FolderSearchIcon />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>Kein Projekt gefunden</ComboboxEmpty>
        <ComboboxList>
          {(key: string) => {
            const project = byKey.get(key);
            return (
              <ComboboxItem key={key} value={key} className="min-h-8">
                {project ? <ProjectAvatar project={project} className="size-5" /> : <FolderSearchIcon className="text-muted-foreground" />}
                <span className="flex-1 truncate">{label(key)}</span>
                {project && <span className="text-xs text-muted-foreground">{project.key}</span>}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
