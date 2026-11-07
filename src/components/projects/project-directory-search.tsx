import { SearchIcon, XIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { ProjectDirectoryProps as Props } from "@/types/project-directory";

export function ProjectDirectorySearch({ query, onQueryChange }: Pick<Props, "query" | "onQueryChange">) {
  return (
    <InputGroup className="h-9 w-full sm:w-72">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Name oder Schlüssel"
        aria-label="Bereiche durchsuchen"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && query && onQueryChange("")}
      />
      {query && (
        <InputGroupAddon align="inline-end">
          <Tooltip content="Suche leeren">
            <InputGroupButton size="icon-sm" aria-label="Suche leeren" onClick={() => onQueryChange("")}>
              <XIcon />
            </InputGroupButton>
          </Tooltip>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
