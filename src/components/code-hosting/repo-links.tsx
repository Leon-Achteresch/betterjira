import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LinkIcon, XIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EASE_OUT } from "@/lib/ease";

type Option = { value: string; label: string };

export type RepoLinkGroup = { projectKey: string; projectName: string; links: Array<{ id: string; repo: string; source: string }> };

type RepoLinksProps = {
  projects: Option[];
  connections: Option[];
  projectKey: string;
  connectionId: string;
  repo: string;
  repos: string[];
  reposLoading: boolean;
  reposError: string | null;
  groups: RepoLinkGroup[];
  onProjectChange: (key: string) => void;
  onConnectionChange: (id: string) => void;
  onRepoChange: (repo: string) => void;
  onLink: () => void;
  onUnlink: (projectKey: string, id: string) => void;
};

function OptionSelect({ id, value, options, placeholder, onChange }: { id: string; value: string; options: Option[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next ?? ""))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RepoLinks(props: RepoLinksProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <Field>
          <FieldLabel htmlFor="link-project">Bereich</FieldLabel>
          <OptionSelect id="link-project" value={props.projectKey} options={props.projects} placeholder="Bereich wählen" onChange={props.onProjectChange} />
        </Field>
        <Field>
          <FieldLabel htmlFor="link-connection">Verbindung</FieldLabel>
          <OptionSelect
            id="link-connection"
            value={props.connectionId}
            options={props.connections}
            placeholder="Verbindung wählen"
            onChange={props.onConnectionChange}
          />
        </Field>
        <Field data-invalid={!!props.reposError || undefined}>
          <FieldLabel htmlFor="link-repo">Repository</FieldLabel>
          <Combobox items={props.repos} value={props.repo || null} onValueChange={(value) => props.onRepoChange(value ?? "")}>
            <ComboboxInput
              id="link-repo"
              placeholder={props.reposLoading ? "Lade Repositories…" : "Repository suchen"}
              disabled={!props.connectionId || props.reposLoading}
            />
            <ComboboxContent>
              <ComboboxEmpty>Kein Repository gefunden</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {props.reposError && <FieldError>{props.reposError}</FieldError>}
        </Field>
        <Button onClick={props.onLink} disabled={!props.projectKey || !props.connectionId || !props.repo}>
          <LinkIcon />
          Verknüpfen
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {props.groups.map((group) => (
            <motion.section
              key={group.projectKey}
              layout={!reduce}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex flex-col gap-1"
            >
              <h3 className="text-sm font-medium">
                {group.projectName} <span className="font-mono text-xs text-muted-foreground">{group.projectKey}</span>
              </h3>
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {group.links.map((link) => (
                    <motion.li
                      key={link.id}
                      layout={!reduce}
                      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      className="flex items-center gap-3 rounded-md py-1 pr-1 pl-2 text-sm hover:bg-muted"
                    >
                      <span className="font-mono">{link.repo}</span>
                      <span className="truncate text-xs text-muted-foreground">{link.source}</span>
                      <Tooltip content="Verknüpfung lösen">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="ml-auto"
                          aria-label={`${link.repo} lösen`}
                          onClick={() => props.onUnlink(group.projectKey, link.id)}
                        >
                          <XIcon />
                        </Button>
                      </Tooltip>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          ))}
        </AnimatePresence>
        {props.groups.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Repositories verknüpft.</p>}
      </div>
    </div>
  );
}
