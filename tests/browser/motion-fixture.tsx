import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import "@/index.css";

function Fixture() {
  const [count, setCount] = useState(0);
  const [checked, setChecked] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-dvh flex-col items-start gap-6 p-8">
        <h1>Glass und Motion</h1>
        <Button onClick={() => setCount(count + 1)}>Aktion</Button>
        <output aria-label="Aktionen">{count}</output>
        <Button disabled>Deaktiviert</Button>
        <Card>
          <CardContent>Lesbare Glasfläche</CardContent>
        </Card>
        <Switch
          aria-label="Kontrollierter Schalter"
          checked={checked}
          onCheckedChange={setChecked}
        />
        <Switch aria-label="Freier Schalter" defaultChecked />
        <Checkbox aria-label="Auswahl" defaultChecked="indeterminate" />
        <Progress
          aria-label="Fortschritt"
          value={checked ? 80 : 20}
          className="w-48"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button>Popover öffnen</Button>
          </PopoverTrigger>
          <PopoverContent aria-label="Testpopover">
            <Button>Popover-Aktion</Button>
          </PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Dialog öffnen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Testdialog</DialogTitle>
            <DialogDescription>
              Glasdialog mit Fokusverwaltung.
            </DialogDescription>
            <Button>Dialog-Aktion</Button>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button>Sheet öffnen</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Testsheet</SheetTitle>
            <SheetDescription>Glaspanel mit Fokusverwaltung.</SheetDescription>
            <Button>Sheet-Aktion</Button>
          </SheetContent>
        </Sheet>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>Menü öffnen</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setCount(count + 1)}>
              Ausführen
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Untermenü</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => setCount(count + 1)}>
                  Weitere Aktion
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button>Abschnitt</Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Button>Abschnitt-Aktion</Button>
          </CollapsibleContent>
        </Collapsible>
      </main>
    </MotionConfig>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
