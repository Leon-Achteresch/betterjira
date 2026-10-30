import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PlusIcon, TerminalIcon, Trash2Icon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";

export type ConnectionListItem = { id: string; label: string; account: string | null; viaCli: boolean };

type ConnectionListProps = {
  connections: ConnectionListItem[];
  cliLoading: boolean;
  cliError: string | null;
  removingId: string | null;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

export function ConnectionList(props: ConnectionListProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {props.connections.map((connection) => (
            <motion.li
              key={connection.id}
              layout={!reduce}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>
                    {connection.label}
                    {connection.viaCli && (
                      <Badge variant="secondary">
                        <TerminalIcon />
                        GitHub CLI
                      </Badge>
                    )}
                  </ItemTitle>
                  <ItemDescription>{connection.account ? `Angemeldet als ${connection.account}` : "Token im Schlüsselbund"}</ItemDescription>
                </ItemContent>
                {!connection.viaCli && (
                  <ItemActions>
                    <Tooltip content="Verbindung entfernen">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${connection.label} entfernen`}
                        disabled={props.removingId === connection.id}
                        onClick={() => props.onRemove(connection.id)}
                      >
                        {props.removingId === connection.id ? <Spinner /> : <Trash2Icon />}
                      </Button>
                    </Tooltip>
                  </ItemActions>
                )}
              </Item>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {props.cliLoading ? (
        <Spinner />
      ) : (
        props.cliError && (
          <p className="text-sm text-muted-foreground">
            GitHub CLI nicht verfügbar: {props.cliError}. GitHub und GitHub Enterprise erscheinen hier automatisch nach{" "}
            <code className="font-mono text-xs">gh auth login</code> bzw.{" "}
            <code className="font-mono text-xs">gh auth login --hostname github.firma.de</code>.
          </p>
        )
      )}
      <Button variant="outline" className="self-start" onClick={props.onAdd}>
        <PlusIcon />
        Verbindung hinzufügen
      </Button>
    </div>
  );
}
