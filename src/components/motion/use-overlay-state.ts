import { useControllableState } from "@/components/motion/use-controllable-state";

export function useOverlayState({
  open,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [value, onChange] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return { open: value, onOpenChange: onChange };
}
