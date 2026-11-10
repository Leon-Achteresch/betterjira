import { JiraLogo, GithubLogo, BitbucketLogo, OutlookLogo } from "@/components/brands/service-logos";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRightIcon, GitBranchIcon, LogInIcon, RotateCwIcon, ShieldCheckIcon, WifiIcon, WifiOffIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { ConnectionsOverviewModel } from "@/hooks/connections/use-connections-overview";
import { EASE_OUT } from "@/lib/ease";
import { ConnectionCard } from "./connection-card";
import { StatusBadge } from "./status-badge";

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive">
      {children}
    </p>
  );
}

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NetworkCard({ online }: { online: boolean }) {
  return (
    <ConnectionCard
      icon={online ? WifiIcon : WifiOffIcon}
      title="Netzwerk dieses Geräts"
      status={online ? { label: "Gerät meldet online", tone: "neutral" } : { label: "Gerät offline", tone: "warning" }}
    >
      <Muted>
        {online
          ? "Das Gerät meldet eine Netzwerkverbindung. Ob Jira, GitHub oder Bitbucket erreichbar sind, zeigt erst eine Prüfung des jeweiligen Dienstes."
          : "Das Gerät meldet keine Netzwerkverbindung. Bereits geladene Daten und Entwürfe bleiben erhalten, können aber veraltet sein."}
      </Muted>
    </ConnectionCard>
  );
}

function JiraActions({ jira }: { jira: ConnectionsOverviewModel["jira"] }) {
  const { check } = jira;
  if (jira.sessionStatus === "connected")
    return (
      <>
        <Button variant="outline" onClick={check.onCheck} disabled={!check.canCheck}>
          {check.checking ? <Spinner /> : <ShieldCheckIcon />}
          Jira prüfen
        </Button>
        {check.checking && (
          <Button variant="ghost" onClick={check.onCancel}>
            <XIcon />
            Prüfung abbrechen
          </Button>
        )}
      </>
    );
  if (jira.sessionStatus === "unconnected")
    return (
      <Button onClick={jira.onLogin} disabled={jira.loggingIn}>
        {jira.loggingIn ? <Spinner /> : <LogInIcon />}
        {jira.loggingIn ? "Warte auf Browser" : "Mit Atlassian verbinden"}
      </Button>
    );
  if (jira.sessionStatus === "error")
    return (
      <Button variant="outline" onClick={jira.onRetry} disabled={jira.retrying}>
        {jira.retrying ? <Spinner /> : <RotateCwIcon />}
        Anmeldung erneut lesen
      </Button>
    );
  return null;
}

function JiraCard({ jira, online }: { jira: ConnectionsOverviewModel["jira"]; online: boolean }) {
  const { check } = jira;
  return (
    <ConnectionCard
      icon={JiraLogo}
      title="Jira"
      status={jira.status}
      actions={jira.sessionStatus === "pending" ? undefined : <JiraActions jira={jira} />}
    >
      {jira.sessionStatus === "pending" && <Skeleton className="h-4 w-48" />}
      {jira.sessionStatus === "unconnected" && (
        <>
          <Muted>Auf diesem Gerät ist keine Jira-Anmeldung gespeichert.</Muted>
          {jira.loginError && <ErrorText>{jira.loginError}</ErrorText>}
        </>
      )}
      {jira.sessionStatus === "error" && (
        <>
          <Muted>Die gespeicherte Anmeldung konnte nicht gelesen werden. Das ist keine Abmeldung.</Muted>
          {jira.sessionError && <ErrorText>{jira.sessionError}</ErrorText>}
        </>
      )}
      {jira.sessionStatus === "connected" && (
        <>
          <p>
            Angemeldet bei <span className="font-medium">{jira.siteName}</span>
            {jira.siteUrl && <span className="text-muted-foreground"> · {jira.siteUrl.replace(/^https?:\/\//, "")}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Erreichbarkeit:</span>
            <StatusBadge status={check.status} />
            {check.detail && <span className="text-muted-foreground tabular-nums">{check.detail}</span>}
          </div>
          <Reveal show={!!check.error}>
            <ErrorText>{check.error}</ErrorText>
          </Reveal>
          <Reveal show={!online}>
            <Muted>Gerät offline: Eine Prüfung ist erst wieder mit Netzwerk möglich.</Muted>
          </Reveal>
        </>
      )}
    </ConnectionCard>
  );
}

function ScmCard({ scm }: { scm: ConnectionsOverviewModel["scm"] }) {
  return (
    <ConnectionCard
      icon={GitBranchIcon}
      title="Code-Hosting"
      status={scm.status}
      actions={
        <Button variant="outline" asChild>
          <Link to="/settings/code-hosting">
            Code-Hosting verwalten
            <ArrowUpRightIcon />
          </Link>
        </Button>
      }
    >
      {scm.loading && scm.connections.length === 0 ? (
        <Skeleton className="h-4 w-56" />
      ) : scm.waiting && scm.connections.length === 0 ? (
        <Muted>GitHub CLI wird gelesen, sobald das Gerät wieder online ist.</Muted>
      ) : scm.connections.length === 0 ? (
        <Muted>Keine GitHub- oder Bitbucket-Verbindung eingerichtet.</Muted>
      ) : (
        <ul className="flex flex-col gap-2">
          {scm.connections.map((connection) => (
            <li key={connection.id} className="flex flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2">
              <span className="font-medium">
                {connection.kind === "GitHub" ? <GithubLogo aria-hidden className="mr-2 inline size-4" /> : <BitbucketLogo aria-hidden className="mr-2 inline size-4" />}{connection.label} <span className="font-normal text-muted-foreground">· {connection.kind}</span>
              </span>
              <span className="break-words text-muted-foreground">
                {connection.host}
                {connection.account && ` · ${connection.account}`}
                {" · "}
                {connection.viaCli
                  ? `Laut GitHub CLI angemeldet${scm.cliReadAt ? ` (gelesen um ${scm.cliReadAt})` : ""}`
                  : "Token gespeichert, nicht geprüft"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {scm.cliError && <Muted>GitHub CLI nicht lesbar: {scm.cliError}</Muted>}
    </ConnectionCard>
  );
}

function OutlookCard({ outlook }: { outlook: ConnectionsOverviewModel["outlook"] }) {
  return (
    <ConnectionCard
      icon={OutlookLogo}
      title="Outlook-Kalender"
      status={outlook.status}
      actions={
        <>
          {outlook.canCheck && (
            <Button variant="outline" onClick={outlook.onCheck} disabled={outlook.checking}>
              {outlook.checking ? <Spinner /> : <RotateCwIcon />}
              Outlook prüfen
            </Button>
          )}
          <Button variant={outlook.configured ? "ghost" : "outline"} asChild>
            <Link to="/kalender">
              {outlook.configured ? "Zum Kalender" : "Im Kalender verbinden"}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </>
      }
    >
      {outlook.account ? (
        <p>
          Klassisches Outlook · <span className="font-medium">{outlook.account}</span>
          {outlook.checkedAt && <span className="text-muted-foreground tabular-nums"> · zuletzt geprüft um {outlook.checkedAt}</span>}
        </p>
      ) : (
        !outlook.configured && <Muted>Kein Outlook-Kalender verbunden.</Muted>
      )}
      <Reveal show={!!outlook.error}>
        <ErrorText>{outlook.error}</ErrorText>
      </Reveal>
      <Muted>Gelesen werden nur Konto und Status, keine Termine.</Muted>
    </ConnectionCard>
  );
}

export function ConnectionsOverview(model: ConnectionsOverviewModel) {
  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-balance">Verbindungen</h2>
        <p className="text-sm text-muted-foreground">
          Anmeldungen und Verbindungen dieses Geräts auf einen Blick. Ein Online-Gerät heißt nicht, dass jeder Dienst erreichbar ist.
        </p>
      </div>
      <Stagger className="flex flex-col gap-3">
        <StaggerItem>
          <NetworkCard online={model.online} />
        </StaggerItem>
        <StaggerItem>
          <JiraCard jira={model.jira} online={model.online} />
        </StaggerItem>
        <StaggerItem>
          <ScmCard scm={model.scm} />
        </StaggerItem>
        <StaggerItem>
          <OutlookCard outlook={model.outlook} />
        </StaggerItem>
      </Stagger>
    </section>
  );
}
