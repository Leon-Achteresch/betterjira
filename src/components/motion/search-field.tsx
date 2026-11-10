import type { ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Ref } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip } from "@/components/motion/tooltip";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "value" | "onChange" | "className"> & {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export function SearchField({ value, onChange, onKeyDown, inputRef, label, placeholder, className, ...inputProps }: Props) {
  const reduce = useReducedMotion();
  return (
    <InputGroup className={cn("h-8 rounded-xl", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        {...inputProps}
        className="[&::-webkit-search-cancel-button]:appearance-none"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
      />
      <AnimatePresence initial={false}>
        {value && (
          <InputGroupAddon align="inline-end">
            <motion.span
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              transition={{ duration: 0.12, ease: EASE_OUT }}
            >
              <Tooltip content="Suche leeren" side="bottom">
                <InputGroupButton size="icon-xs" aria-label="Suche leeren" onClick={() => onChange("")}>
                  <XIcon />
                </InputGroupButton>
              </Tooltip>
            </motion.span>
          </InputGroupAddon>
        )}
      </AnimatePresence>
    </InputGroup>
  );
}
