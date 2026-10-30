import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EASE_OUT, SPRING_SWAP } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";

function ValidationState({ validating, errors, empty }: { validating: boolean; errors: readonly string[]; empty: boolean }) {
  const state = empty ? "empty" : validating ? "validating" : errors.length > 0 ? "invalid" : "valid";
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
        transition={SPRING_SWAP}
        className="flex items-center gap-1 text-xs"
      >
        {state === "validating" && <Spinner className="size-3.5 text-muted-foreground" />}
        {state === "valid" && (
          <span className="flex items-center gap-1 text-success">
            <CircleCheckIcon className="size-3.5" />
            Gültig
          </span>
        )}
        {state === "invalid" && (
          <span className="flex items-center gap-1 text-destructive">
            <CircleAlertIcon className="size-3.5" />
            {errors.length === 1 ? "1 Fehler" : `${errors.length} Fehler`}
          </span>
        )}
      </motion.span>
    </AnimatePresence>
  );
}

export function JqlEditor({
  value,
  onChange,
  onApply,
  errors,
  validating,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  errors: readonly string[];
  validating: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onApply();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="JQL"
          aria-invalid={errors.length > 0 || undefined}
          placeholder='project = "ABC" AND statusCategory != Done ORDER BY updated DESC'
          className="min-h-20 pr-24 font-mono text-[0.8rem] leading-relaxed"
        />
        <span className="absolute top-2 right-2.5">
          <ValidationState validating={validating} errors={errors} empty={!value.trim()} />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {errors.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            role="alert"
            className="flex flex-col gap-0.5 text-xs text-destructive"
          >
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <KbdGroup>
            <Kbd>{IS_MAC ? "⌘" : "Strg"}</Kbd>
            <Kbd>↵</Kbd>
          </KbdGroup>
          anwenden
        </span>
      </div>
    </div>
  );
}
