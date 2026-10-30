use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri_plugin_http::reqwest;

use super::KEYRING_SERVICE;

const GH_PATHS: [&str; 4] = [
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "/usr/bin/gh",
    "/home/linuxbrew/.linuxbrew/bin/gh",
];

static GH_TOKENS: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Auth {
    Gh { host: String },
    Token { id: String, username: Option<String> },
}

#[derive(Serialize, Deserialize)]
struct StoredToken {
    token: String,
    host: String,
}

#[derive(Serialize)]
pub struct ScmResponse {
    status: u16,
    body: String,
}

fn gh(args: &[&str]) -> Result<String, String> {
    let program = GH_PATHS
        .iter()
        .find(|path| std::path::Path::new(path).exists())
        .copied()
        .unwrap_or("gh");
    let mut command = Command::new(program);
    command.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let output = command.output().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => "GitHub CLI (gh) nicht gefunden. Installiere sie und führe `gh auth login` aus.".to_string(),
        _ => e.to_string(),
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stdout.is_empty() {
        return Ok(stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() { "gh lieferte keine Ausgabe".to_string() } else { stderr })
}

fn gh_token(host: &str, fresh: bool) -> Result<String, String> {
    let mut cache = GH_TOKENS.lock().map_err(|e| e.to_string())?;
    if fresh {
        cache.retain(|(cached, _)| cached != host);
    } else if let Some((_, token)) = cache.iter().find(|(cached, _)| cached == host) {
        return Ok(token.clone());
    }
    let token = gh(&["auth", "token", "--hostname", host])?;
    cache.push((host.to_string(), token.clone()));
    Ok(token)
}

fn token_entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, &format!("scm-{id}")).map_err(|e| e.to_string())
}

fn stored_token(id: &str) -> Result<StoredToken, String> {
    match token_entry(id)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw).map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => Err("Für diese Verbindung ist kein Token gespeichert".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn ensure_host(url: &str, host: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err("Nur http- und https-Adressen sind erlaubt".to_string());
    }
    let target = match parsed.port() {
        Some(port) => format!("{}:{port}", parsed.host_str().unwrap_or_default()),
        None => parsed.host_str().unwrap_or_default().to_string(),
    };
    if target == host || target == format!("api.{host}") {
        Ok(())
    } else {
        Err(format!("Der Token für {host} darf nicht an {target} gesendet werden"))
    }
}

async fn send(auth: &Auth, url: &str, method: &reqwest::Method, body: &Option<String>, fresh: bool) -> Result<ScmResponse, String> {
    let mut request = reqwest::Client::new()
        .request(method.clone(), url)
        .header("Accept", "application/json")
        .header("User-Agent", "betterjira");
    request = match auth {
        Auth::Gh { host } => {
            ensure_host(url, host)?;
            let host = host.clone();
            let token = tauri::async_runtime::spawn_blocking(move || gh_token(&host, fresh))
                .await
                .map_err(|e| e.to_string())??;
            request.bearer_auth(token)
        }
        Auth::Token { id, username } => {
            let stored = stored_token(id)?;
            ensure_host(url, &stored.host)?;
            match username {
                Some(username) => request.basic_auth(username, Some(stored.token)),
                None => request.bearer_auth(stored.token),
            }
        }
    };
    if let Some(body) = body {
        request = request.header("Content-Type", "application/json").body(body.clone());
    }
    let response = request.send().await.map_err(|e| format!("Server nicht erreichbar: {e}"))?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(ScmResponse { status, body })
}

#[tauri::command]
pub async fn scm_request(auth: Auth, url: String, method: String, body: Option<String>) -> Result<ScmResponse, String> {
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
    let response = send(&auth, &url, &method, &body, false).await?;
    if response.status == 401 && matches!(auth, Auth::Gh { .. }) {
        return send(&auth, &url, &method, &body, true).await;
    }
    Ok(response)
}

#[tauri::command]
pub async fn scm_gh_hosts() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| gh(&["auth", "status", "--json", "hosts"]))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn scm_token_set(id: String, token: String, host: String) -> Result<(), String> {
    let value = serde_json::to_string(&StoredToken { token, host }).map_err(|e| e.to_string())?;
    token_entry(&id)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scm_token_delete(id: String) -> Result<(), String> {
    match token_entry(&id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
