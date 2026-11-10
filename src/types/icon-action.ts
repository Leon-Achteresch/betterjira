import type { ReactNode } from "react";
import type { HTMLMotionProps } from "motion/react";

export type IconActionProps = Omit<HTMLMotionProps<"button">, "onClick" | "children"> & {
  label: string;
  tooltip: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
};
