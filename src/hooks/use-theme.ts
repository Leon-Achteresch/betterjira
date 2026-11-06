import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme as useNextTheme } from "next-themes";

export type ThemePreference = "system" | "light" | "dark";

const isThemePreference = (value: string | undefined): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const THEME_CYCLE = {
  system: { next: "light", label: "Design: System", Icon: Monitor },
  light: { next: "dark", label: "Design: Hell", Icon: Sun },
  dark: { next: "system", label: "Design: Dunkel", Icon: Moon },
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
  return { theme, label, Icon, cycle: () => setTheme(next) };
};
