use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RolloutInput {
    id: String,
    title: String,
    start: String,
    end: String,
    body: String,
    reminder_minutes: u32,
    event_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum OutlookRequest {
    Account,
    #[serde(rename_all = "camelCase")]
    List {
        account_id: String,
        start: String,
        end: String,
    },
    #[serde(rename_all = "camelCase")]
    Upsert {
        account_id: String,
        rollout: RolloutInput,
    },
    #[serde(rename_all = "camelCase")]
    Delete {
        account_id: String,
        event_id: String,
        rollout_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Open {
        account_id: String,
        event_id: String,
        occurrence_start: Option<String>,
    },
}

fn is_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 4096 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn is_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, byte)| {
            if matches!(i, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

fn validate(request: &OutlookRequest) -> Result<(), String> {
    let account_id = match request {
        OutlookRequest::Account => return Ok(()),
        OutlookRequest::List { account_id, .. }
        | OutlookRequest::Upsert { account_id, .. }
        | OutlookRequest::Delete { account_id, .. }
        | OutlookRequest::Open { account_id, .. } => account_id,
    };
    if !is_id(account_id) {
        return Err("Ungueltiger Outlook-Kalender.".into());
    }
    match request {
        OutlookRequest::List { start, end, .. } => {
            if !is_iso_instant(start) || !is_iso_instant(end) {
                return Err("Ungueltiger Kalenderzeitraum.".into());
            }
        }
        OutlookRequest::Upsert { rollout, .. } => {
            if !is_uuid(&rollout.id)
                || rollout.title.trim().is_empty()
                || rollout.title.chars().count() > 255
                || rollout.body.len() > 200_000
                || !is_iso_instant(&rollout.start)
                || !is_iso_instant(&rollout.end)
                || ![0, 5, 15, 30, 60, 1440].contains(&rollout.reminder_minutes)
                || rollout.event_id.as_ref().is_some_and(|id| !is_id(id))
            {
                return Err("Ungueltiger Rollout.".into());
            }
        }
        OutlookRequest::Delete {
            event_id,
            rollout_id,
            ..
        } => {
            if !is_id(event_id) || !is_uuid(rollout_id) {
                return Err("Ungueltiger Outlook-Termin.".into());
            }
        }
        OutlookRequest::Open {
            event_id,
            occurrence_start,
            ..
        } => {
            if !is_id(event_id)
                || occurrence_start
                    .as_ref()
                    .is_some_and(|value| !is_iso_instant(value))
            {
                return Err("Ungueltiger Outlook-Termin.".into());
            }
        }
        OutlookRequest::Account => {}
    }
    Ok(())
}

fn is_iso_instant(value: &str) -> bool {
    value.len() >= 20
        && value.len() <= 35
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || b"-:TZ+.".contains(&byte))
        && value.as_bytes().get(10) == Some(&b'T')
}

fn payload(request: OutlookRequest) -> Value {
    match request {
        OutlookRequest::Account => serde_json::json!({ "action": "account" }),
        OutlookRequest::List {
            account_id,
            start,
            end,
        } => {
            serde_json::json!({ "action": "list", "accountId": account_id, "start": start, "end": end })
        }
        OutlookRequest::Upsert {
            account_id,
            rollout,
        } => serde_json::json!({
            "action": "upsert", "accountId": account_id, "rollout": {
                "id": rollout.id, "title": rollout.title, "start": rollout.start, "end": rollout.end,
                "body": rollout.body, "reminderMinutes": rollout.reminder_minutes, "eventId": rollout.event_id,
            }
        }),
        OutlookRequest::Delete {
            account_id,
            event_id,
            rollout_id,
        } => {
            serde_json::json!({ "action": "delete", "accountId": account_id, "eventId": event_id, "rolloutId": rollout_id })
        }
        OutlookRequest::Open {
            account_id,
            event_id,
            occurrence_start,
        } => {
            serde_json::json!({ "action": "open", "accountId": account_id, "eventId": event_id, "occurrenceStart": occurrence_start })
        }
    }
}

fn decode_response(raw: &[u8]) -> Result<Value, String> {
    let response: Value = serde_json::from_slice(raw)
        .map_err(|_| "Outlook lieferte keine gueltige Antwort.".to_string())?;
    if response.get("ok").and_then(Value::as_bool) == Some(true) {
        response
            .get("result")
            .cloned()
            .ok_or_else(|| "Outlook lieferte kein Ergebnis.".into())
    } else {
        Err(response
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("Outlook-Anfrage fehlgeschlagen.")
            .to_string())
    }
}

#[cfg(windows)]
fn execute(request: Value) -> Result<Value, String> {
    use std::io::{Read, Write};
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    let system_root = std::env::var_os("SystemRoot").ok_or("Windows-Systemverzeichnis fehlt.")?;
    let program = std::path::PathBuf::from(system_root)
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(program)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-STA",
            "-Command",
            include_str!("outlook.ps1"),
        ])
        .creation_flags(0x0800_0000)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Die lokale Outlook-Verbindung konnte nicht gestartet werden.".to_string())?;
    let mut stdin = child.stdin.take().ok_or("Outlook-Eingabe fehlt.")?;
    stdin
        .write_all(request.to_string().as_bytes())
        .map_err(|e| e.to_string())?;
    drop(stdin);
    let mut stdout = child.stdout.take().ok_or("Outlook-Ausgabe fehlt.")?;
    let mut stderr = child.stderr.take().ok_or("Outlook-Fehlerausgabe fehlt.")?;
    let output = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout.read_to_end(&mut bytes).map(|_| bytes)
    });
    let errors = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.read_to_end(&mut bytes).map(|_| bytes)
    });
    let started = Instant::now();
    loop {
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            break;
        }
        if started.elapsed() > Duration::from_secs(45) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Outlook antwortet nicht. Bitte klassisches Outlook oeffnen, eventuelle Dialoge schliessen und erneut versuchen.".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let bytes = output
        .join()
        .map_err(|_| "Outlook-Ausgabe konnte nicht gelesen werden.")?
        .map_err(|e| e.to_string())?;
    let _ = errors.join();
    decode_response(&bytes)
}

#[cfg(not(windows))]
fn execute(_request: Value) -> Result<Value, String> {
    Err("Die lokale Outlook-Verbindung benoetigt klassisches Outlook unter Windows. Rollouts koennen weiterhin lokal geplant werden.".into())
}

#[tauri::command]
pub async fn outlook_request(request: OutlookRequest) -> Result<Value, String> {
    validate(&request)?;
    let request = payload(request);
    tauri::async_runtime::spawn_blocking(move || execute(request))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_validation_rejects_foreign_input() {
        let request = OutlookRequest::Open {
            account_id: "ABCDEF".into(),
            event_id: "'; Start-Process calc; '".into(),
            occurrence_start: None,
        };
        assert!(validate(&request).is_err());
        assert!(is_uuid("3e79080d-a50b-4000-8000-123456789abc"));
        assert!(!is_uuid("3e79080d-a50b-4000-8000-123456789ab'"));
        assert!(!is_iso_instant("2026-11-06'; exit; '"));
    }

    #[test]
    fn command_serialization_preserves_text_as_data() {
        let request: OutlookRequest = serde_json::from_value(serde_json::json!({
            "action": "upsert", "accountId": "ABC123", "rollout": {
                "id": "3e79080d-a50b-4000-8000-123456789abc", "title": "Rollout ' $(exit)",
                "start": "2026-11-06T09:00:00Z", "end": "2026-11-06T10:00:00Z", "body": "Zeile 1\nZeile 2",
                "reminderMinutes": 15, "eventId": null
            }
        })).unwrap();
        assert!(validate(&request).is_ok());
        assert_eq!(payload(request)["rollout"]["title"], "Rollout ' $(exit)");
    }

    #[test]
    fn outlook_response_requires_success_and_result() {
        assert_eq!(
            decode_response(br#"{"ok":true,"result":null}"#).unwrap(),
            Value::Null
        );
        assert!(decode_response(br#"{"ok":true}"#).is_err());
        assert_eq!(
            decode_response(br#"{"ok":false,"error":"Nicht installiert"}"#).unwrap_err(),
            "Nicht installiert"
        );
        assert!(decode_response(b"not json").is_err());
    }
}
