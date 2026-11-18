use std::{borrow::Cow, env, fs, path::PathBuf};

use serde_json::json;
use tauri::ipc::CapabilityBuilder;
use tauri::utils::{
    assets::{AssetKey, AssetsIter, CspHash},
    config::{AppDirectoriesOverride, Csp},
};
use tauri::{Assets, Manager, WebviewUrl, WebviewWindowBuilder, Wry};

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
        eprintln!("{} failed: {error}", app.config().identifier);
        app.exit(1);
    } else {
        println!("{} passed", app.config().identifier);
        app.exit(0);
    }
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let (name, window, entry) = match env::var("C1_IPC_SCENARIO")?.as_str() {
        "c1" => (
            "betterjira C1 IPC Fixture",
            "c1-ipc-fixture",
            "tests/native/c1-tauri/fixture.html",
        ),
        "n01" => (
            "betterjira N01 IPC Fixture",
            "n01-ipc-fixture",
            "tests/native/n01-tauri/fixture.html",
        ),
        "n02" => (
            "betterjira N02 IPC Fixture",
            "n02-ipc-fixture",
            "tests/native/n02-tauri/fixture.html",
        ),
        "n03" => (
            "betterjira N03 IPC Fixture",
            "n03-ipc-fixture",
            "tests/native/n03-tauri/fixture.html",
        ),
        "n04" => (
            "betterjira N04 IPC Fixture",
            "n04-ipc-fixture",
            "tests/native/n04-tauri/fixture.html",
        ),
        "n05" => (
            "betterjira N05 IPC Fixture",
            "n05-ipc-fixture",
            "tests/native/n05-tauri/fixture.html",
        ),
        "n09" => (
            "betterjira N09 IPC Fixture",
            "n09-ipc-fixture",
            "tests/native/n09-tauri/fixture.html",
        ),
        _ => return Err("Unknown IPC fixture scenario".into()),
    };
    let identifier = format!("com.leon.betterjira.{window}");
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
    config.identifier = identifier;
    config.product_name = Some(name.into());
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

    let mut init =
        format!("window.__C1_JIRA_ORIGIN__ = {origin:?}; window.__C1_CANARY_ORIGIN__ = {trap:?};");
    if window == "n02-ipc-fixture" {
        init.push_str("Object.defineProperty(window, '__N02_NATIVE_FIXTURE__', { value: true });");
    }
    if window == "n03-ipc-fixture" {
        init.push_str("Object.defineProperty(window, '__N03_NATIVE_FIXTURE__', { value: true });");
    }
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
                    "siteName": name,
                }).to_string()
            )?;
            app.add_capability(
                CapabilityBuilder::new(window)
                    .window(window)
                    .permission("core:default")
                    .permission_scoped("http:default", vec![json!({ "url": format!("{origin}/*") })], vec![]),
            )?;
            println!("Tauri fixture ready with private data {data:?}, incognito WebView and HTTP scope {origin}");
            WebviewWindowBuilder::new(
                app,
                window,
                WebviewUrl::App(entry.into()),
            )
            .title(name)
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
