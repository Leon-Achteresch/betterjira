import { Link } from "@tanstack/react-router";
import { ZammadLogo } from "@/components/brands/service-logos";
import { PersonLabel } from "@/components/people/person-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { ZammadSettingsModel } from "@/hooks/zammad/use-zammad-connection";

export function ZammadConnectionSettings(model: ZammadSettingsModel) {
  return (
    <section aria-label="Zammad" className="flex flex-col gap-5 px-1 py-4">
      <header className="flex items-center gap-3">
        <ZammadLogo aria-hidden className="size-6" />
        <h3 className="flex-1 text-sm font-medium">Zammad</h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          {model.connection ? "Verbunden" : "Nicht verbunden"}
        </span>
      </header>
      {model.loading ? (
        <Skeleton className="h-10 w-full" />
      ) : model.connection && !model.editing ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {model.person ? (
              <PersonLabel
                {...model.person}
                subtitle={model.connection.baseUrl}
              />
            ) : (
              <p className="text-sm">
                {model.account}
                <span className="block text-xs text-muted-foreground">
                  {model.connection.baseUrl}
                </span>
              </p>
            )}
            <Button asChild>
              <Link to="/helpdesk">Zammad-Tickets öffnen</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={model.onCheck}
              disabled={model.checking}
            >
              {model.checking ? "Prüfe …" : "Verbindung prüfen"}
            </Button>
            <Button variant="ghost" onClick={model.onEdit}>
              Zugang ändern
            </Button>
            <Button
              variant="ghost"
              onClick={model.onDisconnect}
              disabled={model.removing}
            >
              {model.removing ? "Trenne …" : "Trennen"}
            </Button>
          </div>
        </>
      ) : (
        <Stagger className="flex flex-col gap-4">
          <StaggerItem>
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Verbinde deine Instanz einmalig mit Adresse und persönlichem
              API-Token.
            </p>
            <label className="grid gap-2 text-[13px]">
              Zammad-Adresse
              <Input
                type="url"
                autoComplete="url"
                placeholder="https://support.deinefirma.de"
                value={model.baseUrl}
                onChange={(event) => model.setBaseUrl(event.target.value)}
              />
            </label>
          </StaggerItem>
          <StaggerItem>
            <label className="grid gap-2 text-[13px]">
              API-Token
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Persönlichen API-Token einfügen"
                value={model.token}
                onChange={(event) => model.setToken(event.target.value)}
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Der Token benötigt ticket.agent und Zugriff auf deine
              Ticketgruppen. Er wird im sicheren Speicher dieses Geräts
              hinterlegt.
            </p>
          </StaggerItem>
          <StaggerItem>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer py-1 font-medium text-foreground">
                Kein Token-Zugriff im Profil?
              </summary>
              <p className="mt-2 leading-relaxed">
                Dein Administrator muss in Zammad unter System → API den
                Token-Zugriff aktivieren und deiner Rolle die Berechtigung
                user_preferences.access_token geben. Erst dann erscheint der
                Menüpunkt im Profil. Die App kann diese Freigabe nicht ersetzen.
              </p>
            </details>
          </StaggerItem>
          <StaggerItem className="flex justify-end gap-2">
            {model.editing && (
              <Button
                variant="ghost"
                onClick={model.onCancel}
                disabled={model.saving}
              >
                Abbrechen
              </Button>
            )}
            <Button
              onClick={model.onSave}
              disabled={!model.canSave || model.saving}
            >
              {model.saving ? "Verbinde …" : "Zammad verbinden"}
            </Button>
          </StaggerItem>
        </Stagger>
      )}
      {model.error && (
        <p role="alert" className="text-sm text-destructive">
          {model.error}
        </p>
      )}
    </section>
  );
}
