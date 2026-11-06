use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

mod attention;
mod oauth;
mod scm;
mod secrets;

const SESSION_KEY: &str = "atlassian-session";

#[tauri::command]
fn session_get() -> Result<Option<String>, String> {
    secrets::get(SESSION_KEY)
}

#[tauri::command]
fn session_set(value: String) -> Result<(), String> {
    secrets::set(SESSION_KEY, &value)
}

#[tauri::command]
fn session_delete() -> Result<(), String> {
    secrets::delete(SESSION_KEY)
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            session_get,
            session_set,
            session_delete,
            attention::attention_serve,
            attention::attention_read,
            attention::attention_trigger,
            oauth::oauth_login,
            oauth::oauth_cancel,
            scm::scm_request,
            scm::scm_gh_hosts,
            scm::scm_token_set,
            scm::scm_token_delete
        ])
        .setup(|app| {
            secrets::init(app.path().app_data_dir()?);
            let open = MenuItem::with_id(app, "open", "betterjira öffnen", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("betterjira")
                .menu(&Menu::with_items(app, &[&open, &quit])?)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main(_app);
            }
        });
}
