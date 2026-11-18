import { useState } from "react";
import { parseDayKey } from "@/lib/time-tracking/range";
import {
  planSelectedWorklogDays, selectedWorklogDayError, selectedWorklogTime, type WorklogStartWindow,
} from "@/lib/time-tracking/selected-worklog-days";

export function useSelectedWorklogDays(seed: { duration: string; started: string }, accountId: string, loaded?: WorklogStartWindow) {
  const [duration, setDuration] = useState(seed.duration);
  const [time, setTime] = useState(() => selectedWorklogTime(seed.started));
  const [day, setDay] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [dayError, setDayError] = useState<string>();
  const [previewed, setPreviewed] = useState(false);

  return {
    duration, time, day, days, dayError,
    canAddDay: !!parseDayKey(day),
    plan: previewed ? planSelectedWorklogDays({ days, time, duration, accountId, loaded }) : undefined,
    setDuration: (value: string) => { setDuration(value); setPreviewed(false); },
    setTime: (value: string) => { setTime(value); setPreviewed(false); },
    setDay: (value: string) => { setDay(value); setDayError(undefined); },
    addDay: () => {
      const error = selectedWorklogDayError(day, days);
      setDayError(error);
      if (error) return;
      setDays((previous) => previous.includes(day) ? previous : [...previous, day].sort());
      setDay("");
      setPreviewed(false);
    },
    removeDay: (value: string) => {
      setDays((previous) => previous.filter((item) => item !== value));
      setDayError(undefined);
      setPreviewed(false);
    },
    preview: () => setPreviewed(true),
  };
}
