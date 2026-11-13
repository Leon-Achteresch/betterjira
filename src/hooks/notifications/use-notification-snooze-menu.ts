import { useState } from "react";
import { format } from "date-fns";
import { snoozeUntil, type SnoozePreset } from "@/lib/notifications/snooze";

export const useNotificationSnoozeMenu = (
  onSnooze: (until: number) => void,
  until?: number,
) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [openedAt, setOpenedAt] = useState(Date.now);
  const [error, setError] = useState<string | null>(null);
  const select = (until: number) => {
    if (!Number.isFinite(until) || until <= Date.now()) {
      setError("Wähle einen Zeitpunkt in der Zukunft.");
      return;
    }
    setOpen(false);
    onSnooze(until);
  };
  return {
    open,
    setOpen: (value: boolean) => {
      if (value) {
        setDate(until === undefined ? "" : format(until, "yyyy-MM-dd'T'HH:mm"));
        setError(null);
        setOpenedAt(Date.now());
      }
      setOpen(value);
    },
    date,
    setDate: (value: string) => {
      setDate(value);
      setError(null);
    },
    minDate: format(openedAt, "yyyy-MM-dd'T'HH:mm"),
    error,
    selectPreset: (preset: SnoozePreset) =>
      select(snoozeUntil(preset, Date.now())),
    submitDate: () => select(new Date(date).getTime()),
  };
};
