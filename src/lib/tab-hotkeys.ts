export type TabHotkey = { type: "close" } | { type: "select"; index: number } | { type: "cycle"; step: 1 | -1 } | { type: "history"; step: 1 | -1 };

type KeyInput = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export const tabHotkey = (event: KeyInput, isMac: boolean): TabHotkey | undefined => {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  if (event.ctrlKey && event.key === "Tab") return { type: "cycle", step: event.shiftKey ? -1 : 1 };
  if (event.altKey && !mod && event.key === "ArrowLeft") return { type: "history", step: -1 };
  if (event.altKey && !mod && event.key === "ArrowRight") return { type: "history", step: 1 };
  if (!mod || event.altKey || event.shiftKey) return undefined;
  if (event.code === "BracketLeft") return { type: "history", step: -1 };
  if (event.code === "BracketRight") return { type: "history", step: 1 };
  if (event.key.toLowerCase() === "w") return { type: "close" };
  const digit = /^Digit([1-9])$/.exec(event.code);
  return digit ? { type: "select", index: Number(digit[1]) - 1 } : undefined;
};

export const cycleTab = (keys: string[], activeKey: string | undefined, step: 1 | -1) => {
  if (keys.length === 0) return undefined;
  const index = activeKey ? keys.indexOf(activeKey) : -1;
  if (index === -1) return step === 1 ? keys[0] : keys.at(-1);
  return keys[(index + step + keys.length) % keys.length];
};
