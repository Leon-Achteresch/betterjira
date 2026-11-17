use std::{borrow::Cow, env, fs, path::PathBuf};

use serde_json::json;
use tauri::ipc::CapabilityBuilder;
use tauri::utils::{
    assets::{AssetKey, AssetsIter, CspHash},
    config::{AppDirectoriesOverride, Csp},
};
use tauri::{Assets, Manager, WebviewUrl, WebviewWindowBuilder, Wry};

const WINDOW: &str = "c1-ipc-fixture";
const IDENTIFIER: &str = "com.leon.betterjira.c1-ipc-fixture";

struct FixtureAssets(PathBuf);

impl Assets<Wry> for FixtureAssets {
    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        let path = self
            .0
            .join(key.as_ref().trim_start_matches('/'))
            .canonicalize()
            .ok()?;
        if !path.starts_with(&self.0) {
            return None;
        }
        fs::read(path).ok().map(Cow::Owned)
    }

    fn iter(&self) -> Box<AssetsIter<'_>> {
        Box::new(std::iter::empty())
    }

    fn csp_hashes(&self, _: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        Box::new(std::iter::empty())
    }
}

#[tauri::command]
fn fixture_finish(app: tauri::AppHandle, error: Option<String>) {
    if let Some(error) = error {
        eprintln!("C1 IPC fixture failed: {error}");
        app.exit(1);
    } else {
        println!("C1 IPC fixture passed");
        app.exit(0);
    }
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let work = PathBuf::from(env::var("C1_IPC_TEST_ROOT")?).canonicalize()?;
    let home = work.join("home");
    let temporary = work.join("tmp");
    let state = work.join("data");
    let assets = work.join("dist");
    if env::var_os("HOME").as_deref() != Some(home.as_os_str())
        || env::var_os("CFFIXED_USER_HOME").as_deref() != Some(home.as_os_str())
        || env::var_os("TMPDIR").as_deref() != Some(temporary.as_os_str())
        || home.canonicalize()? != home
        || temporary.canonicalize()? != temporary
        || state.canonicalize()? != state
        || assets.canonicalize()? != assets
        || state.read_dir()?.next().transpose()?.is_some()
    {
        return Err("Fixture requires fresh private app data, HOME and TMPDIR".into());
    }
    let port: u16 = env::var("C1_IPC_JIRA_PORT")?.parse()?;
    let canary: u16 = env::var("C1_IPC_CANARY_PORT")?.parse()?;
    if port == 0 || canary == 0 || port == canary {
        return Err("Fixture requires separate nonzero loopback ports".into());
    }
    let origin = format!("http://127.0.0.1:{port}");
    let trap = format!("http://127.0.0.1:{canary}");
    let mut context = tauri::generate_context!("tauri.conf.json", test = true);
    let config = context.config_mut();
    config.identifier = IDENTIFIER.into();
    config.product_name = Some("betterjira C1 IPC Fixture".into());
    config.build.dev_url = None;
    config.app.windows.clear();
    config.plugins.0.clear();
    config.app.app_directories_override = Some(AppDirectoriesOverride::Root(state.clone()));
    let csp = Csp::Policy(
        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src ipc: http://ipc.localhost; form-action 'none'; base-uri 'none'".into(),
    );
    config.app.security.csp = Some(csp.clone());
    config.app.security.dev_csp = Some(csp);
    context.set_assets(Box::new(FixtureAssets(assets)));

    let init =
        format!("window.__C1_JIRA_ORIGIN__ = {origin:?}; window.__C1_CANARY_ORIGIN__ = {trap:?};");
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            super::session_get,
            super::session_set,
            super::session_delete,
            fixture_finish,
        ])
        .setup(move |app| {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let data = app.path().app_data_dir()?;
            if !data.starts_with(&state) || !app.path().app_cache_dir()?.starts_with(&state) {
                return Err("Tauri resolved app data or cache outside the fixture root".into());
            }
            super::secrets::init(data.clone());
            super::session_set(
                json!({
                    "accessToken": "mock",
                    "refreshToken": "mock-refresh",
                    "expiresAt": 4_102_444_800_000_i64,
                    "cloudId": "mock-cloud",
                    "siteUrl": "https://mock-jira.atlassian.net",
                    "siteName": "C1 IPC Fixture",
                }).to_string()
            )?;
            app.add_capability(
                CapabilityBuilder::new("c1-fixture")
                    .window(WINDOW)
                    .permission("core:default")
                    .permission_scoped("http:default", vec![json!({ "url": format!("{origin}/*") })], vec![]),
            )?;
            println!("Tauri fixture ready with private data {data:?}, incognito WebView and HTTP scope {origin}");
            WebviewWindowBuilder::new(
                app,
                WINDOW,
                WebviewUrl::App("tests/native/c1-tauri/fixture.html".into()),
            )
            .title("betterjira C1 IPC Fixture")
            .inner_size(1280.0, 900.0)
            .focused(false)
            .incognito(true)
            .initialization_script(init)
            .on_navigation(|url| url.scheme() == "tauri" && url.host_str() == Some("localhost"))
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .build()?;
            Ok(())
        })
        .run(context)?;
    Ok(())
}
