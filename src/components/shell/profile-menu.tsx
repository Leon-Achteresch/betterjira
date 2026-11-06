import { ChevronsUpDownIcon, ExternalLinkIcon, LogInIcon, LogOutIcon, RotateCwIcon, ShieldAlertIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import type { ProfileMenuState } from "@/hooks/jira/use-profile-menu";
import { EASE_OUT } from "@/lib/ease";

export function ProfileMenu({ profile }: { profile: ProfileMenuState }) {
  const { session } = profile;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={session.status === "pending" ? "connected" : session.status}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
        transition={{ duration: 0.18, ease: EASE_OUT }}
      >
        {session.status === "error" ? (
          <SessionRetryButton profile={profile} />
        ) : session.status === "unconnected" ? (
          <LoginButton profile={profile} />
        ) : (
          <AccountMenu profile={profile} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function SessionRetryButton({ profile: { session } }: { profile: ProfileMenuState }) {
  return (
    <SidebarMenuButton
      size="lg"
      variant="outline"
      aria-label="Anmeldung erneut prüfen"
      tooltip="Anmeldung konnte nicht geprüft werden – erneut prüfen"
      onClick={session.retry}
      disabled={session.retrying}
    >
      {session.retrying ? <Spinner /> : <ShieldAlertIcon />}
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate font-medium">Anmeldung nicht geprüft</span>
        <span className="truncate text-xs text-muted-foreground">Erneut prüfen</span>
      </span>
      <RotateCwIcon className="ml-auto text-muted-foreground" />
    </SidebarMenuButton>
  );
}

function LoginButton({ profile: { login } }: { profile: ProfileMenuState }) {
  return (
    <div className="flex flex-col gap-1">
      <SidebarMenuButton size="lg" variant="outline" onClick={() => login.mutate()} disabled={login.isPending}>
        {login.isPending ? <Spinner /> : <LogInIcon />}
        <span>{login.isPending ? "Warte auf Browser" : "Mit Atlassian verbinden"}</span>
      </SidebarMenuButton>
      {login.error && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {login.error.message}
        </p>
      )}
    </div>
  );
}

function AccountMenu({ profile }: { profile: ProfileMenuState }) {
  const { session, name, initials, email, avatarUrl, logout, openSite } = profile;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <Avatar className="size-8">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium">{name || "…"}</span>
            <span className="truncate text-xs text-muted-foreground">{session.site?.siteName}</span>
          </div>
          <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuLabel className="grid font-normal">
          <span className="font-medium">{name}</span>
          {email && <span className="text-xs text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {openSite && (
          <DropdownMenuItem onSelect={openSite}>
            <ExternalLinkIcon />
            Jira öffnen
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOutIcon />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
