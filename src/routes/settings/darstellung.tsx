import { createFileRoute } from "@tanstack/react-router";
import { KeyboardIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemePicker, type ThemeOption } from "@/components/settings/theme-picker";
import { ShortcutKeys } from "@/components/shell/shortcut-help";
import { Button } from "@/components/ui/button";
import { useShortcutHelp } from "@/hooks/use-app-shortcuts";
import { type ThemePreference, useTheme } from "@/hooks/use-theme";
import { SHORTCUTS } from "@/lib/shortcuts";

export const Route = createFileRoute("/settings/darstellung")({
  component: Darstellung,
});

const THEME_OPTIONS: ThemeOption<ThemePreference>[] = [
  { value: "system", label: "System", icon: MonitorIcon, schemes: ["light", "dark"] },
  { value: "light", label: "Hell", icon: SunIcon, schemes: ["light"] },
  { value: "dark", label: "Dunkel", icon: MoonIcon, schemes: ["dark"] },
];

const HELP_KEYS = SHORTCUTS.find((shortcut) => shortcut.id === "help")?.keys ?? [];

function Darstellung() {
  const { theme, setTheme } = useTheme();
  const openHelp = useShortcutHelp((state) => state.setOpen);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Erscheinungsbild</h2>
          <p className="text-sm text-muted-foreground">
            „System“ folgt automatisch dem Hell- oder Dunkelmodus deines Betriebssystems.
          </p>
        </div>
        <ThemePicker label="Erscheinungsbild" value={theme} options={THEME_OPTIONS} onChange={setTheme} />
      </section>
      <section className="flex items-center justify-between gap-6 border-t pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Tastenkürzel</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Alle Kürzel siehst du jederzeit mit <ShortcutKeys keys={HELP_KEYS} />
          </p>
        </div>
        <Button variant="outline" onClick={() => openHelp(true)}>
          <KeyboardIcon />
          Übersicht öffnen
        </Button>
      </section>
    </div>
  );
}
