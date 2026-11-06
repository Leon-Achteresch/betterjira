import { useTheme as useNextTheme } from "next-themes";

export type ThemePreference = "system" | "light" | "dark";

const isThemePreference = (value: string | undefined): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

export const useTheme = () => {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: isThemePreference(theme) ? theme : "system",
    setTheme: (next: ThemePreference) => setTheme(next),
  };
};
