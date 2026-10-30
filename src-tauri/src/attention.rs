use std::io::Read;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_http::reqwest;
use tiny_http::{Header, Method, Request, Response, Server};

pub const PORT: u16 = 8743;
const MAX_BODY_BYTES: usize = 1024 * 1024;
const FILE_NAME: &str = "attention.json";

static TOKEN: Mutex<String> = Mutex::new(String::new());
static SERVER: OnceLock<()> = OnceLock::new();

fn result_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(FILE_NAME))
}

fn reply(request: Request, status: u16, body: &str) {
    let header = Header::from_bytes("Content-Type", "application/json").expect("static header");
    let _ = request.respond(Response::from_string(body).with_status_code(status).with_header(header));
}

fn authorized(request: &Request) -> bool {
    let token = TOKEN.lock().map(|t| t.clone()).unwrap_or_default();
    !token.is_empty()
        && request.headers().iter().any(|h| {
            h.field.equiv("Authorization") && h.value.as_str() == format!("Bearer {token}")
        })
}

fn handle(app: &AppHandle, mut request: Request) {
    if request.url() != "/attention" {
        return reply(request, 404, r#"{"error":"not found"}"#);
    }
    if *request.method() != Method::Post {
        return reply(request, 405, r#"{"error":"use POST"}"#);
    }
    if !authorized(&request) {
        return reply(request, 401, r#"{"error":"invalid token"}"#);
    }
    let mut body = String::new();
    let read = request.as_reader().take(MAX_BODY_BYTES as u64 + 1).read_to_string(&mut body);
    if read.is_err() || body.len() > MAX_BODY_BYTES {
        return reply(request, 413, r#"{"error":"body too large or not utf-8"}"#);
    }
    if let Err(e) = serde_json::from_str::<serde_json::Value>(&body) {
        return reply(request, 400, &serde_json::json!({ "error": format!("invalid json: {e}") }).to_string());
    }
    match result_path(app).and_then(|path| std::fs::write(path, &body).map_err(|e| e.to_string())) {
        Ok(()) => {
            let _ = app.emit("attention-updated", ());
            reply(request, 200, r#"{"ok":true}"#)
        }
        Err(e) => reply(request, 500, &serde_json::json!({ "error": e }).to_string()),
    }
}

#[tauri::command]
pub fn attention_serve(app: AppHandle, token: String) -> Result<u16, String> {
    *TOKEN.lock().map_err(|e| e.to_string())? = token;
    if SERVER.get().is_some() {
        return Ok(PORT);
    }
    let server = Server::http(("127.0.0.1", PORT)).map_err(|e| format!("Port {PORT} ist belegt: {e}"))?;
    let _ = SERVER.set(());
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            handle(&app, request);
        }
    });
    Ok(PORT)
}

#[tauri::command]
pub fn attention_read(app: AppHandle) -> Result<Option<String>, String> {
    match std::fs::read_to_string(result_path(&app)?) {
        Ok(body) => Ok(Some(body)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn attention_trigger(url: String, body: String) -> Result<(), String> {
    let response = reqwest::Client::new()
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Webhook nicht erreichbar: {e}"))?;
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let text = response.text().await.unwrap_or_default();
    Err(format!("Webhook antwortet mit {status}: {}", text.chars().take(300).collect::<String>()))
}
