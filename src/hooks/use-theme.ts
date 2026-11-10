import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme as useNextTheme } from "next-themes";

export type ThemePreference = "system" | "light" | "dark";

const isThemePreference = (value: string | undefined): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const THEME_CYCLE = {
  system: { next: "light", label: "Helles Design verwenden", Icon: Monitor },
  light: { next: "dark", label: "Dunkles Design verwenden", Icon: Sun },
  dark: { next: "system", label: "Systemdesign verwenden", Icon: Moon },
} as const;

export const useTheme = () => {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: isThemePreference(theme) ? theme : "system",
    setTheme: (next: ThemePreference) => setTheme(next),
  };
};

export const useThemeCycle = () => {
  const { theme, setTheme } = useTheme();
  const { next, label, Icon } = THEME_CYCLE[theme];
  return { theme, label, Icon, NextIcon: THEME_CYCLE[next].Icon, cycle: () => setTheme(next) };
};
