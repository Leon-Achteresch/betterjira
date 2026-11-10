$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'

function Get-OutlookApplication([scriptblock]$getRunning = { [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }) {
    try {
        $application = & $getRunning
    } catch {
        throw 'Bitte klassisches Outlook selbst oeffnen, dort den gewuenschten Kalender pruefen und danach erneut verbinden. betterjira startet Outlook und dessen Office-Anmeldung nicht automatisch. Das neue Outlook wird nicht unterstuetzt.'
    }
    if ($null -eq $application) {
        throw 'Keine geoeffnete klassische Outlook-Instanz gefunden. Bitte klassisches Outlook oeffnen und danach erneut verbinden.'
    }
    return $application
}

function Get-Instant([string]$value) {
    return [DateTimeOffset]::Parse($value, [Globalization.CultureInfo]::InvariantCulture)
}

function Get-Appointment($session, $calendar, [string]$entryId) {
    try {
        $item = $session.GetItemFromID($entryId, $calendar.StoreID)
    } catch {
        throw 'Der Outlook-Termin wurde verschoben oder geloescht. Bitte Outlook pruefen.'
    }
    if ($item.Class -ne 26 -or $item.Parent.EntryID -ne $calendar.EntryID) {
        throw 'Der Termin befindet sich nicht im verbundenen Outlook-Kalender.'
    }
    return $item
}

function Assert-OwnedAppointment($item, [string]$rolloutId) {
    $property = $item.UserProperties.Find('BetterJiraRolloutId')
    if ($null -eq $property -or $property.Value -ne $rolloutId) {
        throw 'Dieser Outlook-Termin gehoert nicht zu diesem betterjira-Rollout.'
    }
    if ($item.MeetingStatus -ne 0 -or $item.IsRecurring) {
        throw 'Dieser Termin wurde in Outlook zu einer Besprechung oder Serie geaendert. Bitte direkt in Outlook bearbeiten.'
    }
}

function Find-RolloutAppointment($calendar, [string]$rolloutId) {
    if ($null -eq $calendar.UserDefinedProperties.Find('BetterJiraRolloutId')) { return $null }
    return $calendar.Items.Find("[BetterJiraRolloutId] = '$rolloutId'")
}

function Invoke-OutlookRequest($request, $application) {
    $session = $application.Session
    if (-not $session.CurrentProfileName) {
        throw 'Outlook hat noch kein geoeffnetes Profil. Bitte die Kontoanmeldung direkt in Outlook abschliessen und den Kalender oeffnen.'
    }
    $calendar = $session.GetDefaultFolder(9)
    if ($request.action -eq 'account') {
        $email = ''
        foreach ($account in $session.Accounts) {
            if ($null -ne $account.DeliveryStore -and $account.DeliveryStore.StoreID -eq $calendar.StoreID) {
                $email = [string]$account.SmtpAddress
                break
            }
        }
        return @{ id = [string]$calendar.StoreID; displayName = [string]$calendar.Store.DisplayName; email = $email }
    }
    if ([string]$calendar.StoreID -cne [string]$request.accountId) {
        throw 'Das Outlook-Profil wurde gewechselt. Bitte den urspruenglichen Kalender verbinden.'
    }
    switch ($request.action) {
        'list' {
            $from = (Get-Instant $request.start).LocalDateTime
            $until = (Get-Instant $request.end).LocalDateTime
            if ($until -le $from) { throw 'Das Ende muss nach dem Beginn liegen.' }
            $fromText = $from.ToString('g', [Globalization.CultureInfo]::CurrentCulture)
            $untilText = $until.ToString('g', [Globalization.CultureInfo]::CurrentCulture)
            $items = $calendar.Items
            $items.Sort('[Start]')
            $items.IncludeRecurrences = $true
            $filtered = $items.Restrict("[Start] < '$untilText' AND [End] > '$fromText'")
            $events = New-Object 'System.Collections.Generic.List[object]'
            $item = $filtered.GetFirst()
            while ($null -ne $item) {
                if ($events.Count -ge 2000) { throw 'Mehr als 2000 Outlook-Termine in diesem Zeitraum. Bitte den Kalender direkt in Outlook oeffnen.' }
                if ($item.Class -eq 26 -and $item.StartUTC -lt $until.ToUniversalTime() -and $item.EndUTC -gt $from.ToUniversalTime()) {
                    $eventId = [string]$item.EntryID
                    if ($item.IsRecurring) { $eventId += '|' + $item.StartUTC.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture) }
                    $events.Add(@{
                        id = $eventId
                        title = [string]$item.Subject
                        start = $item.StartUTC.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)
                        end = $item.EndUTC.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)
                        webLink = ''
                        isAllDay = [bool]$item.AllDayEvent
                    })
                }
                $item = $filtered.GetNext()
            }
            return ,($events.ToArray())
        }
        'upsert' {
            $rollout = $request.rollout
            if ((Get-Instant $rollout.end) -le (Get-Instant $rollout.start)) { throw 'Das Ende muss nach dem Beginn liegen.' }
            $item = Find-RolloutAppointment $calendar $rollout.id
            if ($null -eq $item -and $rollout.eventId) {
                try { $item = $session.GetItemFromID($rollout.eventId, $calendar.StoreID) } catch {}
                if ($null -ne $item) {
                    if ($item.Parent.EntryID -eq $session.GetDefaultFolder(3).EntryID) { $item = $null }
                    elseif ($item.Class -ne 26 -or $item.Parent.EntryID -ne $calendar.EntryID) { throw 'Der Outlook-Termin wurde verschoben. Bitte direkt in Outlook pruefen.' }
                }
            }
            if ($null -eq $item) {
                $item = $calendar.Items.Add(1)
                $property = $item.UserProperties.Add('BetterJiraRolloutId', 1, $true)
                $property.Value = [string]$rollout.id
            } else {
                Assert-OwnedAppointment $item $rollout.id
            }
            $item.Subject = [string]$rollout.title
            $item.Body = [string]$rollout.body
            $item.StartUTC = (Get-Instant $rollout.start).UtcDateTime
            $item.EndUTC = (Get-Instant $rollout.end).UtcDateTime
            $item.ReminderSet = [int]$rollout.reminderMinutes -gt 0
            if ($item.ReminderSet) { $item.ReminderMinutesBeforeStart = [int]$rollout.reminderMinutes }
            $item.Save()
            return @{ id = [string]$item.EntryID; accountId = [string]$calendar.StoreID }
        }
        'delete' {
            $item = Find-RolloutAppointment $calendar $request.rolloutId
            if ($null -ne $item) {
                Assert-OwnedAppointment $item $request.rolloutId
                $item.Delete()
            } else {
                $item = $null
                try { $item = $session.GetItemFromID($request.eventId, $calendar.StoreID) } catch {}
                if ($null -ne $item) {
                    if ($item.Parent.EntryID -eq $session.GetDefaultFolder(3).EntryID) { return $null }
                    if ($item.Class -ne 26 -or $item.Parent.EntryID -ne $calendar.EntryID) {
                        throw 'Der Outlook-Termin wurde verschoben. Bitte zuerst direkt in Outlook pruefen.'
                    }
                    Assert-OwnedAppointment $item $request.rolloutId
                    $item.Delete()
                }
            }
            return $null
        }
        'open' {
            $item = Get-Appointment $session $calendar $request.eventId
            if ($request.occurrenceStart) {
                $item = $item.GetRecurrencePattern().GetOccurrence((Get-Instant $request.occurrenceStart).LocalDateTime)
            }
            $item.Display($false)
            return $null
        }
        default { throw 'Unbekannte Outlook-Aktion.' }
    }
}

try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($null -eq [type]::GetTypeFromProgID('Outlook.Application')) {
        throw 'Klassisches Outlook ist nicht installiert. Das neue Outlook unterstuetzt diese lokale Verbindung nicht.'
    }
    $application = Get-OutlookApplication
    $result = Invoke-OutlookRequest $request $application
    @{ ok = $true; result = $result } | ConvertTo-Json -Depth 8 -Compress
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Depth 8 -Compress
}
