import { useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { KeyboardIcon, MonitorIcon, MoonIcon, RotateCcwIcon, SunIcon } from "lucide-react";
import { ReadingPreview } from "@/components/settings/reading-preview";
import { TextSizePicker } from "@/components/settings/text-size-picker";
import { ThemePicker, type ThemeOption } from "@/components/settings/theme-picker";
import { ShortcutKeys } from "@/components/shell/shortcut-help";
import { Button } from "@/components/ui/button";
import { useShortcutHelp } from "@/hooks/use-app-shortcuts";
import { useReadability } from "@/hooks/use-readability";
import { type ThemePreference, useTheme } from "@/hooks/use-theme";
import { EASE_OUT } from "@/lib/ease";
import { DEFAULT_TEXT_SIZE, TEXT_SIZE_PRESETS } from "@/lib/readability";
import { SHORTCUTS } from "@/lib/shortcuts";

export const Route = createFileRoute("/settings/darstellung")({
  component: Darstellung,
});

const THEME_OPTIONS: ThemeOption<ThemePreference>[] = [
  { value: "system", label: "System", icon: MonitorIcon, schemes: ["light", "dark"] },
  { value: "light", label: "Hell", icon: SunIcon, schemes: ["light"] },
  { value: "dark", label: "Dunkel", icon: MoonIcon, schemes: ["dark"] },
];

const PREVIEW = {
  eyebrow: "DEMO-42 · Zuletzt aktualisiert 14:05",
  title: "Rechnungsexport bricht bei Sonderzeichen ab",
  body: "Beim Export nach CSV werden Umlaute im Kundennamen falsch kodiert. Bitte vor dem nächsten Rollout prüfen und den Testfall ergänzen.",
  rows: [
    { label: "Status", value: "In Arbeit" },
    { label: "Schätzung", value: "3 Std. 30 Min." },
  ],
};

const HELP_KEYS = SHORTCUTS.find((shortcut) => shortcut.id === "help")?.keys ?? [];

function Darstellung() {
  const { theme, setTheme } = useTheme();
  const { textSize, setTextSize } = useReadability();
  const openHelp = useShortcutHelp((state) => state.setOpen);
  const reduce = useReducedMotion();
  const sizeGroup = useRef<HTMLDivElement>(null);
  const resetTextSize = () => {
    setTextSize(DEFAULT_TEXT_SIZE);
    requestAnimationFrame(() => sizeGroup.current?.focus());
  };

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
      <section className="flex flex-col gap-4 border-t pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <h2 className="font-medium">Textgröße</h2>
            <AnimatePresence initial={false}>
              {textSize !== DEFAULT_TEXT_SIZE && (
                <motion.div
                  initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <Button variant="ghost" onClick={resetTextSize}>
                    <RotateCcwIcon />
                    Zurücksetzen
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="text-sm text-muted-foreground">
            Vergrößert Text im Inhaltsbereich: Tickets, Beschreibungen, Kommentare, Tabellen und Einstellungen.
            Kopfleiste, Seitenleiste und Menüs bleiben gleich. Gilt nur auf diesem Gerät.
          </p>
        </div>
        <TextSizePicker ref={sizeGroup} label="Textgröße" value={textSize} options={TEXT_SIZE_PRESETS} onChange={setTextSize} />
        <ReadingPreview label="Vorschau der Textgröße" {...PREVIEW} />
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
