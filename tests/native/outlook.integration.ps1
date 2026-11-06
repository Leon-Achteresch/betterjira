param([switch]$RunLive)

$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$scriptPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../src-tauri/src/outlook.ps1'))
$tokens = $null
$errors = $null
$scriptAst = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw ($errors | Out-String) }

function Assert($condition, [string]$message) {
    if (-not $condition) { throw $message }
}

$applicationFunction = $scriptAst.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-OutlookApplication' }, $true)
Assert ($null -ne $applicationFunction) 'Anbindung fuer bestehende Outlook-Sitzung fehlt'
. ([scriptblock]::Create($applicationFunction.Extent.Text))
$existing = [pscustomobject]@{ Session = 'existing-session' }
$attached = Get-OutlookApplication { $existing }
Assert ([object]::ReferenceEquals($attached, $existing)) 'Geoeffnete Outlook-Sitzung wird nicht wiederverwendet'
$unavailableRejected = $false
try { Get-OutlookApplication { throw 'MK_E_UNAVAILABLE' } } catch { $unavailableRejected = $_.Exception.Message.Contains('selbst oeffnen') }
Assert $unavailableRejected 'Fehlende Outlook-Sitzung wird nicht erklaert'
$emptyRejected = $false
try { Get-OutlookApplication { $null } } catch { $emptyRejected = $_.Exception.Message.Contains('Outlook-Instanz') }
Assert $emptyRejected 'Leere Outlook-Sitzung wurde akzeptiert'
$activations = @($scriptAst.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'New-Object' -and @($node.CommandElements | Where-Object { $_.Extent.Text -eq '-ComObject' }).Count -gt 0 }, $true))
Assert ($activations.Count -eq 0) 'Outlook darf nicht durch COM-Aktivierung gestartet werden'
$requestFunction = $scriptAst.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-OutlookRequest' }, $true)
. ([scriptblock]::Create($requestFunction.Extent.Text))
$profileRejected = $false
try { Invoke-OutlookRequest @{ action = 'account' } ([pscustomobject]@{ Session = [pscustomobject]@{ CurrentProfileName = '' } }) } catch { $profileRejected = $_.Exception.Message.Contains('noch kein geoeffnetes Profil') }
Assert $profileRejected 'Fehlendes Profil wird nicht vor dem Kalenderzugriff abgewiesen'
Write-Output 'PASS: Syntax, bestehende Outlook-Sitzung, fehlende Sitzung, leere Sitzung, fehlendes Profil, kein automatischer Outlook-Start.'
if (-not $RunLive) { exit 0 }

function Invoke-Request($request) {
    $json = ConvertTo-Json -InputObject $request -Depth 8 -Compress
    $process = New-Object Diagnostics.Process
    $process.StartInfo.FileName = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $process.StartInfo.Arguments = '-NoProfile -NonInteractive -STA -File "' + $scriptPath + '"'
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
    [void]$process.Start()
    $process.StandardInput.Write($json)
    $process.StandardInput.Close()
    $raw = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
    $process.Dispose()
    $response = $raw | ConvertFrom-Json
    if (-not $response.ok) { throw "Outlook-Test ($($request.action)): $($response.error)" }
    return $response.result
}

$account = Invoke-Request @{ action = 'account' }
Assert ($account.id.Length -gt 0) 'Outlook-Kalender-ID fehlt'
$rolloutId = [guid]::NewGuid().ToString()
$rollout = @{
    id = $rolloutId
    title = "[betterjira Test] Rollout ' " + [char]0x00FC + ' $(not-code) ' + $rolloutId
    start = '2099-11-20T09:00:00.000Z'
    end = '2099-11-20T10:00:00.000Z'
    body = 'Automatischer betterjira-Test. Wird anschliessend entfernt.' + "`nhttps://jira.example.com/browse/DEMO-12"
    reminderMinutes = 15
    eventId = $null
}
$saved = $null
try {
    $saved = Invoke-Request @{ action = 'upsert'; accountId = $account.id; rollout = $rollout }
    Assert ($saved.id.Length -gt 0) 'Termin wurde nicht erstellt'
    $again = Invoke-Request @{ action = 'upsert'; accountId = $account.id; rollout = $rollout }
    Assert ($again.id -eq $saved.id) 'Wiederholter Sync hat einen doppelten Termin erstellt'
    $rollout.eventId = $saved.id
    $rollout.title += ' aktualisiert'
    $rollout.reminderMinutes = 30
    $updated = Invoke-Request @{ action = 'upsert'; accountId = $account.id; rollout = $rollout }
    Assert ($updated.id -eq $saved.id) 'Bearbeitung hat einen neuen Termin erstellt'
    $events = @(Invoke-Request @{ action = 'list'; accountId = $account.id; start = '2099-11-20T00:00:00.000Z'; end = '2099-11-21T00:00:00.000Z' })
    $matching = @($events | Where-Object { $_.id -eq $saved.id })
    Assert ($matching.Count -eq 1) 'Termin fehlt im Kalender oder ist doppelt'
    Assert ($matching[0].title -eq $rollout.title) 'Titel wurde nicht aktualisiert'
    Assert ($matching[0].start -eq $rollout.start) 'Beginn wurde in der falschen Zeitzone gespeichert'
    Assert ($matching[0].end -eq $rollout.end) 'Ende wurde in der falschen Zeitzone gespeichert'
    $application = Get-OutlookApplication
    $session = $application.GetNamespace('MAPI')
    $appointment = $session.GetItemFromID($saved.id, $account.id)
    Assert ($appointment.ReminderSet -and $appointment.ReminderMinutesBeforeStart -eq 30) 'Erinnerung wurde nicht gespeichert'
    Assert ($appointment.Body.Contains('https://jira.example.com/browse/DEMO-12')) 'Ticketlink fehlt im Outlook-Termin'
    $rollout.reminderMinutes = 0
    [void](Invoke-Request @{ action = 'upsert'; accountId = $account.id; rollout = $rollout })
    $appointment = $session.GetItemFromID($saved.id, $account.id)
    Assert (-not $appointment.ReminderSet) 'Keine Erinnerung wurde nicht respektiert'
    $pattern = $appointment.GetRecurrencePattern()
    $pattern.RecurrenceType = 0
    $pattern.PatternStartDate = [datetime]'2099-11-20'
    $pattern.Occurrences = 2
    $appointment.Save()
    $series = @(Invoke-Request @{ action = 'list'; accountId = $account.id; start = '2099-11-20T00:00:00.000Z'; end = '2099-11-23T00:00:00.000Z' })
    $occurrences = @($series | Where-Object { $_.title -eq $rollout.title })
    Assert ($occurrences.Count -eq 2) 'Serientermine wurden nicht expandiert'
    Assert ($occurrences[0].id -ne $occurrences[1].id) 'Serientermine haben keine eindeutigen IDs'
    $rejectedSeries = $false
    try { Invoke-Request @{ action = 'upsert'; accountId = $account.id; rollout = $rollout } } catch { $rejectedSeries = $true }
    Assert $rejectedSeries 'Eine nachtraeglich angelegte Serie durfte ueberschrieben werden'
    $appointment = $session.GetItemFromID($saved.id, $account.id)
    $appointment.ClearRecurrencePattern()
    $appointment.Save()
    $rejected = $false
    try { Invoke-Request @{ action = 'delete'; accountId = $account.id; eventId = $saved.id; rolloutId = [guid]::NewGuid().ToString() } } catch { $rejected = $true }
    Assert $rejected 'Fremder Rollout durfte einen Termin loeschen'
    Invoke-Request @{ action = 'delete'; accountId = $account.id; eventId = $saved.id; rolloutId = $rolloutId }
    Invoke-Request @{ action = 'delete'; accountId = $account.id; eventId = $saved.id; rolloutId = $rolloutId }
    $events = @(Invoke-Request @{ action = 'list'; accountId = $account.id; start = '2099-11-20T00:00:00.000Z'; end = '2099-11-21T00:00:00.000Z' })
    Assert (@($events | Where-Object { $_.id -eq $saved.id }).Count -eq 0) 'Termin wurde nicht geloescht'
    Write-Output 'LIVE OUTLOOK PASS: Profil, Erstellen, Wiederholung ohne Duplikat, Bearbeiten, Zeitraum, UTC, Unicode, Ticketlink, Erinnerung und Abschalten, Serientermine, Serienschutz, Eigentumsschutz, Loeschen, wiederholtes Loeschen.'
} finally {
    if ($null -ne $saved) {
        $cleanupApp = Get-OutlookApplication
        $cleanupSession = $cleanupApp.GetNamespace('MAPI')
        $cleanup = $null
        try { $cleanup = $cleanupSession.GetItemFromID($saved.id, $account.id) } catch {}
        if ($null -ne $cleanup -and $cleanup.IsRecurring) {
            $cleanup.ClearRecurrencePattern()
            $cleanup.Save()
        }
        Invoke-Request @{ action = 'delete'; accountId = $account.id; eventId = $saved.id; rolloutId = $rolloutId }
    }
}
