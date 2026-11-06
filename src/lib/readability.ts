import { Option, Schema } from "effect";

export const TextSize = Schema.Literals(["standard", "large", "x-large"]);
export type TextSize = typeof TextSize.Type;

export const DEFAULT_TEXT_SIZE: TextSize = "standard";

export const READABILITY_STORAGE_KEY = "betterjira-readability";
export const READABILITY_STORAGE_VERSION = 1;

export const TEXT_SIZE_PRESETS: { value: TextSize; label: string; scale: number }[] = [
  { value: "standard", label: "Standard", scale: 1 },
  { value: "large", label: "Groß", scale: 1.125 },
  { value: "x-large", label: "Sehr groß", scale: 1.25 },
];

const ReadabilityPrefs = Schema.Struct({ textSize: TextSize });
export type ReadabilityPrefs = typeof ReadabilityPrefs.Type;

export const parseReadabilityPrefs = (value: unknown): ReadabilityPrefs =>
  Option.getOrElse(Schema.decodeUnknownOption(ReadabilityPrefs)(value), () => ({ textSize: DEFAULT_TEXT_SIZE }));

export const textSizeScale = (size: TextSize) =>
  TEXT_SIZE_PRESETS.find((preset) => preset.value === size)?.scale ?? 1;
