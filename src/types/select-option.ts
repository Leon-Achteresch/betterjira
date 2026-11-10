import type { ReactNode } from "react";

export type SelectOption = { value: string; label: string };

export type OptionSelectProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  icon?: ReactNode;
  className?: string;
  onValueChange: (value: string) => void;
};
