import type { ReactNode, ComponentProps } from "react";

export type IconActionProps = Omit<ComponentProps<"button">, "onClick" | "children"> & {
  label: string;
  tooltip: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
};
