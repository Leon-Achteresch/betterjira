import type { ReactNode } from "react";

export type IconActionProps = {
  label: string;
  tooltip: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
};
