import {
  useMemo,
  useState,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type FocusEvent,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { useSubmissionLock } from "@/hooks/use-submission-lock";
import { useZammadPeople } from "./use-zammad-people";
import { useZammadDraft } from "./use-zammad-draft";
import {
  authorId,
  articlePerson,
  canReplyToArticle,
  replyRecipient,
  personFromAddress,
  stateLabel,
  priorityLabel,
} from "@/lib/zammad/people";
import type { TicketPatch, Article } from "@/lib/zammad/model";
import { zammadKeys } from "@/lib/zammad/keys";
import { downloadAttachment } from "@/lib/zammad/attachments";
import { openZammad } from "@/lib/zammad/client";
import { safeArticleHtml, ticketDate } from "@/lib/zammad/presentation";
import {
  formText,
  localDateInput,
  ticketPatch,
} from "@/lib/zammad/ticket-form";
import { useZammadConnection } from "./use-zammad-connection";
import { useUpdateZammadTicket, useZammadWrite } from "./use-zammad-mutations";
import {
  ticketOptions,
  useZammadArticles,
  useZammadLinks,
  useZammadMetadata,
  useZammadTags,
  useZammadTicket,
  useZammadTime,
} from "./use-zammad-queries";
import { useUserPicker } from "./use-user-picker";

export const useHelpdeskDetail = (input: string) => {
  const id =
    /^\d+$/.test(input) && Number.isSafeInteger(Number(input))
      ? Number(input)
      : 0;
  const lock = useSubmissionLock();
  const connection = useZammadConnection();
  const query = useZammadTicket(id);
  const ticket = query.data;
  const activeId = ticket?.id ?? 0;
  const articles = useZammadArticles(activeId);
  const tags = useZammadTags(activeId);
  const time = useZammadTime(activeId);
  const links = useZammadLinks(activeId);
  const states = useZammadMetadata("ticket_states", !!ticket);
  const priorities = useZammadMetadata("ticket_priorities", !!ticket);
  const groups = useZammadMetadata("groups", !!ticket);
  const owner = useUserPicker(
    ticket?.owner_id,
    ticket?.owner ?? undefined,
    (owner_id) => {
      if (owner_id !== ticket?.owner_id) onPropertyChange({ owner_id });
    },
  );
  const customer = useUserPicker(
    ticket?.customer_id,
    ticket?.customer ?? undefined,
    (customer_id) => {
      if (customer_id !== ticket?.customer_id)
        onPropertyChange({ customer_id });
    },
  );
  const update = useUpdateZammadTicket(ticket);
  const write = useZammadWrite(activeId);
  const draft = useZammadDraft(`${connection.data?.baseUrl ?? ""}:${id}`);
  const { body, kind, files } = draft;
  const setBody = (body: string) => draft.update({ body });
  const setKind = (kind: string) => {
    draft.update({ kind });
    setReplyTarget(null);
  };
  const setFiles = (files: File[]) => draft.update({ files });
  const replyTarget = draft.reply;
  const setReplyTarget = (reply: Article | null) => draft.update({ reply });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const people = useZammadPeople([
    ticket?.owner_id,
    ticket?.customer_id,
    ...(articles.data ?? []).map(authorId),
  ]);
  const ownerPerson =
    people.get(ticket?.owner_id ?? 0) ??
    personFromAddress(ticket?.owner ?? "", "Nicht zugewiesen");
  const customerPerson =
    people.get(ticket?.customer_id ?? 0) ??
    personFromAddress(ticket?.customer ?? "", "Kunde");
  const recipient = draft.recipient ?? customerPerson.email ?? "";
  const subject = draft.subject ?? ticket?.title ?? "";
  const [tab, setTab] = useState("conversation");
  const client = useQueryClient();
  const open = useMutation({
    mutationFn: () =>
      Effect.runPromise(
        openZammad(connection.data?.baseUrl ?? "", `ticket/zoom/${id}`),
      ),
    onError: (error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: ({
      articleId,
      attachmentId,
      filename,
    }: {
      articleId: number;
      attachmentId: string | number;
      filename: string;
    }) =>
      Effect.runPromise(
        downloadAttachment(id, articleId, attachmentId, filename),
      ),
    onError: (error) => toast.error(error.message),
  });
  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ticket || update.isPending || !lock.acquire("ticket")) return;
    update.mutate(ticketPatch(new FormData(event.currentTarget), ticket), {
      onSuccess: () =>
        toast.success("Ticket gespeichert", { id: `zammad-ticket-${id}` }),
      onSettled: () => lock.release("ticket"),
    });
  };
  const onArticle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.article.isPending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = formText(data, "body");
    if (!body || !lock.acquire("article")) return;
    void write.article
      .mutateAsync({
        body,
        type: kind === "email" ? "email" : kind === "phone" ? "phone" : "note",
        internal: kind === "internal",
        to: kind === "email" ? recipient.trim() : undefined,
        cc: kind === "email" ? draft.cc.trim() : undefined,
        subject: kind === "email" ? subject : ticket?.title,
        in_reply_to:
          kind === "email" ? (replyTarget?.message_id ?? undefined) : undefined,
        files,
      })
      .then(
        () => {
          form.reset();
          draft.complete();
          toast.success(
            kind === "email" ? "E-Mail versendet" : "Beitrag gespeichert",
          );
        },
        () => undefined,
      )
      .finally(() => lock.release("article"));
  };

  const onTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.tag.isPending) return;
    const form = event.currentTarget;
    const item = formText(new FormData(form), "tag");
    if (item && lock.acquire("tag"))
      write.tag.mutate(
        { item, remove: false },
        { onSuccess: () => form.reset(), onSettled: () => lock.release("tag") },
      );
  };
  const onTime = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.time.isPending) return;
    const form = event.currentTarget;
    const value = formText(new FormData(form), "time");
    if (
      Number.isFinite(Number(value)) &&
      Number(value) > 0 &&
      lock.acquire("time")
    )
      write.time.mutate(value, {
        onSettled: () => lock.release("time"),
        onSuccess: () => {
          form.reset();
          toast.success("Zeit gebucht");
        },
      });
  };
  const onLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (write.link.isPending || !lock.acquire("link")) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    write.link.mutate(
      {
        number: formText(data, "number"),
        type: formText(data, "type"),
        remove: false,
      },
      { onSuccess: () => form.reset(), onSettled: () => lock.release("link") },
    );
  };
  const onPropertyChange = (patch: TicketPatch) => {
    if (!ticket || update.isPending || !lock.acquire("ticket")) return;
    update.mutate(patch, {
      onSettled: () => lock.release("ticket"),
      onSuccess: () =>
        toast.success("Ticket gespeichert", { id: `zammad-ticket-${id}` }),
    });
  };
  const onReply = (article: Article) => {
    if (!canReplyToArticle(article)) return;
    const person = replyRecipient(article);
    draft.update({
      kind: "email",
      recipient: person.email ?? "",
      subject: `Re: ${(article.subject || ticket?.title || "").replace(/^re:\s*/i, "")}`,
    });
    setReplyTarget(article);
    setTab("conversation");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };
  const onTitleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const title = event.currentTarget.value.trim();
    if (title && title !== ticket?.title) onPropertyChange({ title });
  };
  const articleRows = useMemo(
    () =>
      (articles.data ?? []).map((article) => ({
        ...article,
        author: articlePerson(article, people),
        role: article.internal
          ? "Intern"
          : article.sender === "Customer"
            ? "Kunde"
            : "Team",
        canReply: canReplyToArticle(article),
        dateLabel: ticketDate(article.created_at),
        html:
          article.content_type === "text/html"
            ? safeArticleHtml(article.body)
            : undefined,
      })),
    [articles.data, people],
  );
  return {
    ticket,
    people,
    customerPerson,
    ownerPerson,
    stateLabel: stateLabel(ticket?.state),
    priorityLabel: priorityLabel(ticket?.priority),
    onPropertyChange,
    onTitleBlur,
    onTitleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") event.currentTarget.blur();
    },
    onStateChange: (value: string) =>
      onPropertyChange({ state_id: Number(value) }),
    onPriorityChange: (value: string) =>
      onPropertyChange({ priority_id: Number(value) }),
    onGroupChange: (value: string) =>
      onPropertyChange({ group_id: Number(value) }),
    onPendingBlur: (event: FocusEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      const pending_time = value ? new Date(value).toISOString() : null;
      if (pending_time !== (ticket?.pending_time ?? null))
        onPropertyChange({ pending_time });
    },
    onNoteBlur: (event: FocusEvent<HTMLTextAreaElement>) => {
      if (event.currentTarget.value !== (ticket?.note ?? ""))
        onPropertyChange({ note: event.currentTarget.value });
    },
    onReply,
    replyTarget,
    inputRef,
    onComposerKeyDown,
    onCancelReply: () => {
      setReplyTarget(null);
    },
    recipient,
    setRecipient: (recipient: string) => draft.update({ recipient }),
    cc: draft.cc,
    setCc: (cc: string) => draft.update({ cc }),
    composerLabel:
      kind === "email"
        ? "E-Mail senden"
        : kind === "phone"
          ? "Telefonnotiz speichern"
          : kind === "public"
            ? "Öffentlich kommentieren"
            : "Intern kommentieren",
    composerHint:
      kind === "email"
        ? "Wird als E-Mail an den Empfänger versendet."
        : kind === "internal"
          ? "Nur für dein Team sichtbar. Es wird keine E-Mail gesendet."
          : "Für den Kunden sichtbar. Es wird keine E-Mail gesendet.",
    composerPlaceholder:
      kind === "email"
        ? "E-Mail schreiben …"
        : kind === "phone"
          ? "Telefonat dokumentieren …"
          : "Kommentar schreiben …",
    subject,
    setSubject: (subject: string) => draft.update({ subject }),
    connected: !!connection.data,
    loading:
      connection.isPending || (!!connection.data && query.isPending && id > 0),
    error: !id
      ? "Ungültige Ticket-ID"
      : (connection.error?.message ?? query.error?.message),
    onRetry: () => {
      void client.invalidateQueries({ queryKey: zammadKeys.ticket(id) });
      void query.refetch();
    },
    onOpen: () => open.mutate(),
    title: ticket?.title ?? "",
    number: ticket?.number ?? "",
    updated: ticket ? ticketDate(ticket.updated_at) : "",
    created: ticket ? ticketDate(ticket.created_at) : "",
    escalation: ticket?.escalation_at
      ? ticketDate(ticket.escalation_at)
      : undefined,
    pendingTime: localDateInput(ticket?.pending_time),
    states:
      states.data
        ?.filter((row) => row.active !== false)
        .map((row) => ({ ...row, name: stateLabel(row.name) })) ?? [],
    priorities:
      priorities.data
        ?.filter((row) => row.active !== false)
        .map((row) => ({ ...row, name: priorityLabel(row.name) })) ?? [],
    groups: groups.data?.filter((row) => row.active !== false) ?? [],
    metadataError:
      states.error?.message ??
      priorities.error?.message ??
      groups.error?.message,
    owner,
    customer,
    onSave,
    saving: update.isPending,
    articles: articleRows,
    articlesLoading: articles.isPending,
    articlesError: articles.error?.message,
    body,
    setBody,
    kind,
    setKind,
    files,
    onFiles: (files: FileList | null) =>
      setFiles(files ? Array.from(files) : []),
    onArticle,
    sending: write.article.isPending,
    onDownload: (
      articleId: number,
      attachmentId: string | number,
      filename: string,
    ) => download.mutate({ articleId, attachmentId, filename }),
    downloading: download.isPending,
    tags: tags.data?.tags ?? [],
    tagsError: tags.error?.message,
    onTag,
    tagging: write.tag.isPending,
    onRemoveTag: (item: string) => {
      if (!write.tag.isPending) write.tag.mutate({ item, remove: true });
    },
    time: (time.data ?? []).map((entry) => ({
      ...entry,
      dateLabel: ticketDate(entry.created_at),
    })),
    timeError: time.error?.message,
    onTime,
    booking: write.time.isPending,
    totalTime: (time.data ?? []).reduce(
      (sum, entry) => sum + Number(entry.time_unit),
      0,
    ),
    links: (links.data?.links ?? []).map((link) => ({
      ...link,
      title:
        links.data?.assets?.Ticket?.[String(link.link_object_value)]?.title ??
        `Ticket ${link.link_object_value}`,
      number:
        links.data?.assets?.Ticket?.[String(link.link_object_value)]?.number,
    })),
    linksError: links.error?.message,
    onLink,
    linking: write.link.isPending,
    tab,
    setTab,
    onPrefetch: (target: number) =>
      void client.prefetchQuery(ticketOptions(target)),
  };
};
export type HelpdeskDetailModel = ReturnType<typeof useHelpdeskDetail>;
