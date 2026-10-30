import { CheckCircle2Icon, CircleAlertIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

const INTERVALS = [
  { value: 15, label: "Alle 15 Minuten" },
  { value: 30, label: "Alle 30 Minuten" },
  { value: 60, label: "Stündlich" },
  { value: 120, label: "Alle 2 Stunden" },
  { value: 0, label: "Nur manuell" },
];

type AttentionSettingsFormProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  webhookUrl: string;
  onWebhookUrlChange: (url: string) => void;
  intervalMinutes: number;
  onIntervalChange: (minutes: number) => void;
  prompt: string;
  endpoint: { url: string | null; error: string | null };
  canRun: boolean;
  analyzing: boolean;
  onRun: () => void;
};

export function AttentionSettingsForm(props: AttentionSettingsFormProps) {
  return (
    <section className="flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-medium">KI-Briefing</h2>
        <p className="text-muted-foreground">
          Ein Agent in T3 Code liest regelmäßig deine Tickets und zeigt auf der Startseite, was deine Aufmerksamkeit braucht.
        </p>
      </div>

      <ol className="flex flex-col gap-3 text-sm">
        <Step n={1}>In T3 Code unter „Automations“ eine neue Automation mit Trigger „Webhook“ anlegen.</Step>
        <Step n={2}>Dort Projekt, Modell, Einstellungen und Effort wählen und den Prompt unten einfügen.</Step>
        <Step n={3}>Die Webhook-URL der Automation hier eintragen und das Briefing aktivieren.</Step>
      </ol>

      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>Prompt für die T3-Automation</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={props.prompt} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent wrap className="max-h-72 text-xs">{props.prompt}</CodeBlockContent>
      </CodeBlock>

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="attention-enabled">Briefing aktiv</FieldLabel>
            <FieldDescription>Ruft den Webhook im gewählten Intervall auf, solange betterjira läuft (auch im Tray).</FieldDescription>
          </FieldContent>
          <Switch id="attention-enabled" checked={props.enabled} onCheckedChange={props.onEnabledChange} />
        </Field>
        <Field>
          <FieldLabel htmlFor="attention-webhook">Webhook-URL</FieldLabel>
          <Input
            id="attention-webhook"
            type="url"
            placeholder="https://…"
            value={props.webhookUrl}
            onChange={(event) => props.onWebhookUrlChange(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="attention-interval">Intervall</FieldLabel>
          <Select value={String(props.intervalMinutes)} onValueChange={(value) => props.onIntervalChange(Number(value))}>
            <SelectTrigger id="attention-interval" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((interval) => (
                <SelectItem key={interval.value} value={String(interval.value)}>
                  {interval.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={props.onRun} disabled={!props.canRun || props.analyzing}>
          {props.analyzing ? <Spinner /> : <PlayIcon />}
          Jetzt ausführen
        </Button>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {props.endpoint.error ? (
            <>
              <CircleAlertIcon className="size-4 text-destructive" />
              {props.endpoint.error}
            </>
          ) : props.endpoint.url ? (
            <>
              <CheckCircle2Icon className="size-4 text-emerald-500" />
              Lokaler Endpunkt bereit: <code className="font-mono text-xs">{props.endpoint.url}</code>
            </>
          ) : (
            <Spinner />
          )}
        </p>
      </div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium tabular-nums">{n}</span>
      <span>{children}</span>
    </li>
  );
}
