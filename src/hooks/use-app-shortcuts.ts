import { useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { create } from "zustand";
import { focusRowLink } from "@/lib/focusable";
import { shortcutHotkey } from "@/lib/shortcuts";

type ShortcutHelpState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useShortcutHelp = create<ShortcutHelpState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export const useAppShortcuts = () => {
  const navigate = useNavigate();
  const help = useShortcutHelp();

  useHotkeys([
    { hotkey: shortcutHotkey("help"), callback: () => help.setOpen(!help.open) },
    { hotkey: shortcutHotkey("home"), callback: () => void navigate({ to: "/" }) },
    { hotkey: shortcutHotkey("search"), callback: () => void navigate({ to: "/suche", search: {} }) },
    { hotkey: shortcutHotkey("settings"), callback: () => void navigate({ to: "/settings" }) },
    { hotkey: shortcutHotkey("nextRow"), callback: () => focusRowLink(1) },
    { hotkey: shortcutHotkey("prevRow"), callback: () => focusRowLink(-1) },
  ]);

  return help;
};
