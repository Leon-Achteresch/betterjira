use super::secrets;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri_plugin_http::reqwest;

const KEY: &str = "zammad-connection";
static CONNECTION_REVISION: Mutex<u64> = Mutex::new(0);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    base_url: String,
    token: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicConnection {
    base_url: String,
    revision: String,
}

#[derive(Serialize)]
pub struct Response {
    status: u16,
    body: String,
    data: Option<Vec<u8>>,
    content_type: Option<String>,
}

fn normalize_base(value: &str) -> Result<String, String> {
    let mut url = reqwest::Url::parse(value.trim()).map_err(|_| "Ungültige Zammad-Adresse")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Bitte eine HTTPS-Adresse ohne Zugangsdaten, Query oder Fragment verwenden".into(),
        );
    }
    let path = url
        .path()
        .trim_end_matches('/')
        .trim_end_matches("/api/v1")
        .to_string();
    url.set_path(&path);
    Ok(url.to_string().trim_end_matches('/').to_string())
}

fn load() -> Result<Option<Connection>, String> {
    secrets::get(KEY)?
        .map(|raw| {
            serde_json::from_str(&raw)
                .map_err(|_| "Zammad-Verbindung konnte nicht gelesen werden".into())
        })
        .transpose()
}

fn endpoint(base: &str, path: &str) -> Result<reqwest::Url, String> {
    if !path.starts_with('/') || path.starts_with("//") || path.contains('\\') || path.contains('#')
    {
        return Err("Ungültiger Zammad-API-Pfad".into());
    }
    let root = format!("{}/api/v1/", normalize_base(base)?);
    let url = reqwest::Url::parse(&format!("{}{path}", root.trim_end_matches('/')))
        .map_err(|_| "Ungültiger API-Pfad")?;
    if !url.as_str().starts_with(&root) || url.path().contains("/../") {
        return Err("Der API-Pfad liegt außerhalb der Zammad-API".into());
    }
    Ok(url)
}

async fn send(
    connection: &Connection,
    path: &str,
    method: &str,
    body: Option<String>,
    binary: bool,
) -> Result<Response, String> {
    if !matches!(method, "GET" | "POST" | "PUT" | "DELETE") {
        return Err("Nicht unterstützte HTTP-Methode".into());
    }
    let url = endpoint(&connection.base_url, path)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30));
    #[cfg(all(target_os = "macos", feature = "c1-ipc-fixture"))]
    let client = super::c1_ipc_fixture::zammad_client_for_fixture(client, &url)?;
    let client = client
        .build()
        .map_err(|_| "HTTP-Client konnte nicht gestartet werden")?;
    let method =
        reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Ungültige HTTP-Methode")?;
    let mut request = client
        .request(method, url)
        .header("Authorization", format!("Token token={}", connection.token))
        .header("Accept", "application/json");
    if let Some(body) = body {
        request = request
            .header("Content-Type", "application/json")
            .body(body);
    }
    let response = request
        .send()
        .await
        .map_err(|_| "Zammad nicht erreichbar. Adresse und Netzwerk prüfen.")?;
    let status = response.status().as_u16();
    if binary && (200..300).contains(&status) {
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        if response.content_length().unwrap_or(0) > 25 * 1024 * 1024 {
            return Err("Anhang ist größer als 25 MB. Bitte in Zammad herunterladen.".into());
        }
        let data = response
            .bytes()
            .await
            .map_err(|_| "Anhang konnte nicht gelesen werden")?
            .to_vec();
        if data.len() > 25 * 1024 * 1024 {
            return Err("Anhang ist größer als 25 MB".into());
        }
        return Ok(Response {
            status,
            body: String::new(),
            data: Some(data),
            content_type,
        });
    }
    let body = response
        .text()
        .await
        .map_err(|_| "Zammad-Antwort konnte nicht gelesen werden")?;
    Ok(Response {
        status,
        body,
        data: None,
        content_type: None,
    })
}

#[tauri::command]
pub fn zammad_connection_get() -> Result<Option<PublicConnection>, String> {
    let revision = CONNECTION_REVISION
        .lock()
        .map_err(|_| "Zammad-Verbindung ist gesperrt")?;
    Ok(load()?.map(|connection| PublicConnection {
        base_url: connection.base_url,
        revision: revision.to_string(),
    }))
}

#[tauri::command]
pub async fn zammad_connect(base_url: String, token: String) -> Result<PublicConnection, String> {
    let base_url = normalize_base(&base_url)?;
    let token = token.trim().to_string();
    if token.is_empty() || token.contains(['\r', '\n']) {
        return Err("Bitte einen gültigen API-Token eingeben".into());
    }
    let connection = Connection {
        base_url: base_url.clone(),
        token,
    };
    let response = send(&connection, "/users/me", "GET", None, false).await?;
    if response.status != 200 {
        return Err(match response.status {
            401 => "Zammad-Token ist ungültig",
            403 => "Zammad-Token hat keine ausreichenden Berechtigungen",
            _ => "Zammad-Verbindung konnte nicht geprüft werden",
        }
        .into());
    }
    serde_json::from_str::<serde_json::Value>(&response.body)
        .ok()
        .and_then(|value| value.get("id").and_then(|id| id.as_u64()))
        .ok_or("Unerwartete Zammad-Antwort")?;
    let mut revision = CONNECTION_REVISION
        .lock()
        .map_err(|_| "Zammad-Verbindung ist gesperrt")?;
    secrets::set(
        KEY,
        &serde_json::to_string(&connection)
            .map_err(|_| "Verbindung konnte nicht gespeichert werden")?,
    )?;
    *revision += 1;
    Ok(PublicConnection {
        base_url,
        revision: revision.to_string(),
    })
}

#[tauri::command]
pub fn zammad_disconnect() -> Result<(), String> {
    let mut revision = CONNECTION_REVISION
        .lock()
        .map_err(|_| "Zammad-Verbindung ist gesperrt")?;
    secrets::delete(KEY)?;
    *revision += 1;
    Ok(())
}

fn validate_scope(
    base_url: &str,
    revision: u64,
    expected: Option<&PublicConnection>,
) -> Result<(), String> {
    if expected
        .is_some_and(|scope| scope.base_url != base_url || scope.revision != revision.to_string())
    {
        return Err("Zammad-Verbindung wurde gewechselt. Es wurde keine Anfrage gesendet.".into());
    }
    Ok(())
}

fn request_connection(expected: Option<&PublicConnection>) -> Result<Connection, String> {
    let revision = CONNECTION_REVISION
        .lock()
        .map_err(|_| "Zammad-Verbindung ist gesperrt")?;
    let connection = load()?.ok_or("Bitte zuerst Zammad verbinden")?;
    validate_scope(&connection.base_url, *revision, expected)?;
    Ok(connection)
}

fn valid_avatar_path(path: &str) -> bool {
    path.strip_prefix("/users/image/").is_some_and(|hash| {
        !hash.is_empty() && hash.len() <= 128 && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
    })
}

#[tauri::command]
pub async fn zammad_request(
    path: String,
    method: String,
    body: Option<String>,
    binary: Option<bool>,
    connection_scope: Option<PublicConnection>,
) -> Result<Response, String> {
    let connection = request_connection(connection_scope.as_ref())?;
    let binary = binary.unwrap_or(false);
    if binary
        && (!(path.starts_with("/ticket_attachment/") || valid_avatar_path(&path))
            || method != "GET")
    {
        return Err("Ungültiger Anhang-Pfad".into());
    }
    send(&connection, &path, &method, body, binary).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scoped_requests_pin_the_host_and_credential_revision() {
        let scope = PublicConnection {
            base_url: "https://support.example.com".into(),
            revision: "7".into(),
        };
        assert!(validate_scope("https://support.example.com", 7, Some(&scope)).is_ok());
        assert!(validate_scope("https://other.example.com", 7, Some(&scope)).is_err());
        assert!(validate_scope("https://support.example.com", 8, Some(&scope)).is_err());
        assert!(validate_scope("https://support.example.com", 9, Some(&scope)).is_err());
        assert!(validate_scope("https://support.example.com", 9, None).is_ok());
    }
    #[test]
    fn validates_base() {
        assert_eq!(
            normalize_base("https://support.example.com/api/v1/").unwrap(),
            "https://support.example.com"
        );
        assert_eq!(
            normalize_base("https://support.example.com/helpdesk/").unwrap(),
            "https://support.example.com/helpdesk"
        );
        for base in [
            "http://example.com",
            "https://user:pass@example.com",
            "https://example.com?x=1",
            "javascript:alert(1)",
        ] {
            assert!(normalize_base(base).is_err());
        }
    }
    #[test]
    fn avatar_paths_are_confined() {
        assert!(valid_avatar_path("/users/image/aabbcc07"));
        for path in [
            "/users/image/../me",
            "/users/image/hash?token=secret",
            "/users/image/",
            "/users/image/abc.svg",
        ] {
            assert!(!valid_avatar_path(path));
        }
    }
    #[test]
    fn confines_requests() {
        for path in [
            "//evil.example.com",
            "/../users",
            "/%2e%2e/users",
            "/tickets#x",
            "https://evil.example.com",
            "/\\evil",
        ] {
            assert!(
                endpoint("https://support.example.com", path).is_err(),
                "{path}"
            );
        }
        assert!(
            endpoint(
                "https://support.example.com/help",
                "/tickets/search?query=number%3A20043776"
            )
            .is_ok()
        );
    }
}
