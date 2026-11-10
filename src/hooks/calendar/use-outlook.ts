import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { connectOutlook, currentOutlookAccount, disconnectOutlook, listOutlookEvents, openOutlookEvent, openCalendarIssue } from "@/lib/calendar/client";
import { calendarKeys } from "@/lib/calendar/model";
import { errorMessage } from "@/lib/calendar/presentation";

export const useOutlookAccount = () =>
  useQuery({
    queryKey: calendarKeys.account,
    queryFn: ({ signal }) => Effect.runPromise(currentOutlookAccount, { signal }),
    staleTime: 5 * 60_000,
    retry: false,
  });

export const useOutlookEvents = (start: string, end: string, enabled: boolean) =>
  useQuery({
    queryKey: calendarKeys.events(start, end),
    queryFn: ({ signal }) => Effect.runPromise(listOutlookEvents(start, end), { signal }),
    enabled,
    retry: false,
  });

export const useConnectOutlook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Effect.runPromise(connectOutlook()),
    onSuccess: (account) => {
      queryClient.setQueryData(calendarKeys.account, account);
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Outlook verbunden", { description: account.email || account.displayName });
    },
  });
};

export const useDisconnectOutlook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Effect.runPromise(disconnectOutlook),
    onSuccess: () => {
      queryClient.setQueryData(calendarKeys.account, null);
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Outlook getrennt");
    },
  });
};

export const useOpenOutlookEvent = () =>
  useMutation({
    mutationFn: (eventId: string) => Effect.runPromise(openOutlookEvent(eventId)),
    onError: (error) => toast.error("Termin konnte nicht geöffnet werden", { description: errorMessage(error, "Outlook ist nicht erreichbar.") }),
  });

export const useOpenCalendarIssue = () =>
  useMutation({
    mutationFn: (url: string) => Effect.runPromise(openCalendarIssue(url)),
    onError: (error) => toast.error("Ticket konnte nicht geöffnet werden", { description: errorMessage(error, "Bitte erneut versuchen.") }),
  });
