use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tiny_http::{Header, Response, Server};

const PAGE: &str = r#"<!doctype html><html lang="de"><head><meta charset="utf-8"><title>betterjira</title></head><body style="font-family:system-ui,sans-serif;padding:3rem">Verbunden. Du kannst dieses Fenster schließen und zu betterjira zurückkehren.<script>setTimeout(() => window.close(), 300)</script></body></html>"#;

static ACTIVE: Mutex<Option<Arc<Server>>> = Mutex::new(None);

fn bind(port: u16) -> Result<Arc<Server>, String> {
    let mut last = String::new();
    for _ in 0..20 {
        match Server::http(("127.0.0.1", port)) {
            Ok(server) => return Ok(Arc::new(server)),
            Err(e) => last = e.to_string(),
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Err(format!("Port {port} ist belegt: {last}"))
}

fn wait(server: &Server, port: u16) -> Result<String, String> {
    loop {
        let request = server.recv().map_err(|_| "Anmeldung abgebrochen".to_string())?;
        let path = request.url().to_string();
        if !path.starts_with("/callback") {
            let _ = request.respond(Response::empty(404));
            continue;
        }
        let html = Header::from_bytes("Content-Type", "text/html; charset=utf-8").expect("static header");
        let _ = request.respond(Response::from_string(PAGE).with_header(html));
        return Ok(format!("http://localhost:{port}{path}"));
    }
}

#[tauri::command]
pub fn oauth_cancel() {
    if let Some(server) = ACTIVE.lock().ok().and_then(|mut active| active.take()) {
        server.unblock();
    }
}

#[tauri::command]
pub async fn oauth_login(app: AppHandle, port: u16, authorize_url: String) -> Result<String, String> {
    oauth_cancel();
    let server = bind(port)?;
    *ACTIVE.lock().map_err(|e| e.to_string())? = Some(server.clone());
    if let Err(e) = app.opener().open_url(authorize_url, None::<&str>) {
        oauth_cancel();
        return Err(format!("Browser konnte nicht geöffnet werden: {e}"));
    }
    let waiting = server.clone();
    let result = tauri::async_runtime::spawn_blocking(move || wait(&waiting, port))
        .await
        .map_err(|e| e.to_string())?;
    if let Ok(mut active) = ACTIVE.lock() {
        if active.as_ref().is_some_and(|current| Arc::ptr_eq(current, &server)) {
            *active = None;
        }
    }
    result
}
