use std::{borrow::Cow, env, fs, path::PathBuf, sync::OnceLock};

use block2::RcBlock;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
use objc2_foundation::{NSDictionary, NSError};
use objc2_web_kit::WKWebView;
use serde_json::json;
use tauri::ipc::CapabilityBuilder;
use tauri::utils::{
    assets::{AssetKey, AssetsIter, CspHash},
    config::{AppDirectoriesOverride, Csp},
};
use tauri::{Assets, Manager, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_http::reqwest;

static ZAMMAD_TLS: OnceLock<(u16, reqwest::Certificate)> = OnceLock::new();
static SCM_TLS: OnceLock<(u16, reqwest::Certificate)> = OnceLock::new();
pub(crate) const SCM_FIXTURE_ID: &str = "private-n23";

pub(crate) fn scm_client_for_fixture(
    url: &reqwest::Url,
    method: &reqwest::Method,
    auth: &super::scm::Auth,
) -> Result<Option<reqwest::Client>, String> {
    let Some((port, root)) = SCM_TLS.get() else {
        return Ok(None);
    };
    if url.scheme() != "https"
        || url.host_str() != Some("127.0.0.1")
        || url.port() != Some(*port)
        || url.path() != "/api/graphql"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || method != &reqwest::Method::POST
        || !matches!(auth, super::scm::Auth::Token { id, username: None } if id == SCM_FIXTURE_ID)
    {
        return Err("SCM fixture requires its private GraphQL target and synthetic token".into());
    }
    reqwest::Client::builder()
        .no_proxy()
        .tls_built_in_root_certs(false)
        .redirect(reqwest::redirect::Policy::none())
        .add_root_certificate(root.clone())
        .build()
        .map(Some)
        .map_err(|err| err.to_string())
}

async fn scm_headless(origin: &str, state: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    use super::scm::{scm_request, scm_token_set, Auth};
    let auth = || Auth::Token {
        id: SCM_FIXTURE_ID.into(),
        username: None,
    };
    let url = reqwest::Url::parse(&format!("{origin}/api/graphql"))?;
    let control = scm_client_for_fixture(&url, &reqwest::Method::POST, &auth())?
        .ok_or("Private SCM transport not initialized")?;
    super::secrets::init(state);
    let host = origin.strip_prefix("https://").ok_or("Missing private HTTPS origin")?;
    scm_token_set(SCM_FIXTURE_ID.into(), "fixture-scm-token".into(), host.into())?;
    let query = json!({
        "query": "query N23ReviewThreads($owner: String!, $name: String!, $number: Int!, $first: Int!) { viewer { login } repository(owner:$owner,name:$name) { nameWithOwner pullRequest(number:$number) { number url reviewThreads(first:$first) { nodes { id path isResolved isOutdated } } } } }",
        "variables": {"owner":"fixture","name":"repo","number":7,"first":8}
    }).to_string();
    for (phase, status) in [("scm-read", 200), ("scm-redirect", 307)] {
        control
            .post(format!("{origin}/__n25/phase?name={phase}"))
            .bearer_auth("mock")
            .send()
            .await?
            .error_for_status()?;
        let result = scm_request(auth(), url.to_string(), "POST".into(), Some(query.clone())).await?;
        let response = serde_json::to_value(result)?;
        if response["status"] != status {
            return Err(format!("SCM {phase}: expected {status}").into());
        }
        if status == 200 {
            let body: serde_json::Value =
                serde_json::from_str(response["body"].as_str().ok_or("Missing SCM response")?)?;
            let thread = &body["data"]["repository"]["pullRequest"]["reviewThreads"]["nodes"][0];
            if body["data"]["viewer"]["login"] != "fixture-viewer"
                || body["data"]["repository"]["nameWithOwner"] != "fixture/repo"
                || thread["isResolved"] != false
                || thread["isOutdated"] != true
            {
                return Err("Unexpected synthetic SCM identity, repository or thread".into());
            }
        }
    }
    if scm_request(auth(), url.to_string(), "GET".into(), None).await.is_ok()
        || scm_request(Auth::Gh { host: "127.0.0.1".into() }, url.to_string(), "POST".into(), None).await.is_ok()
    {
        return Err("Out-of-scope SCM request was not rejected".into());
    }
    super::scm::scm_token_delete(SCM_FIXTURE_ID.into())?;
    println!("Headless SCM fixture passed: private TLS, synthetic token, GraphQL read and blocked redirect");
    Ok(())
}

pub(crate) fn zammad_client_for_fixture(
    client: reqwest::ClientBuilder,
    url: &reqwest::Url,
) -> Result<reqwest::ClientBuilder, String> {
    let Some((port, root)) = ZAMMAD_TLS.get() else {
        return Ok(client);
    };
    if url.scheme() != "https" || url.host_str() != Some("127.0.0.1") || url.port() != Some(*port) {
        return Err("Zammad fixture requires its private HTTPS origin".into());
    }
    Ok(client
        .no_proxy()
        .tls_built_in_root_certs(false)
        .add_root_certificate(root.clone()))
}

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

#[tauri::command]
async fn fixture_snapshot(window: tauri::WebviewWindow, name: String) -> Result<(), String> {
    if !matches!(name.as_str(), "N07" | "N08" | "N23") || window.label() != "n25-ipc-fixture" {
        return Err("Unknown fixture snapshot".into());
    }
    let folder = PathBuf::from(env::var("C1_IPC_TEST_ROOT").map_err(|err| err.to_string())?)
        .join("screenshots");
    let path = folder.join(format!("{name}.png"));
    let (send, mut receive) = tauri::async_runtime::channel(1);
    window.with_webview(move |webview| {
        let webview = unsafe { &*webview.inner().cast::<WKWebView>() };
        let completion = RcBlock::new(move |image: *mut NSImage, _error: *mut NSError| {
            let png = unsafe { image.as_ref() }
                .and_then(NSImage::TIFFRepresentation)
                .and_then(|tiff| NSBitmapImageRep::imageRepWithData(&tiff))
                .and_then(|bitmap| unsafe {
                    bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
                });
            let result = png.ok_or_else(|| "WKWebView snapshot did not produce PNG data".to_string())
                .and_then(|data| fs::write(&path, data.to_vec()).map_err(|err| err.to_string()));
            let _ = send.try_send(result);
        });
        unsafe { webview.takeSnapshotWithConfiguration_completionHandler(None, &completion) };
    }).map_err(|err| err.to_string())?;
    receive.recv().await.ok_or_else(|| "WKWebView snapshot did not complete".to_string())?
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
        "n16" => (
            "betterjira N16 IPC Fixture",
            "n16-ipc-fixture",
            "tests/native/n16-tauri/fixture.html",
        ),
        "n17" => (
            "betterjira N17 IPC Fixture",
            "n17-ipc-fixture",
            "tests/native/n17-tauri/fixture.html",
        ),
        "n22" => (
            "betterjira N22 IPC Fixture",
            "n22-ipc-fixture",
            "tests/native/n22-tauri/fixture.html",
        ),
        "n25" => (
            "betterjira N25 IPC Fixture",
            "n25-ipc-fixture",
            "tests/native/n25-tauri/fixture.html",
        ),
        _ => return Err("Unknown IPC fixture scenario".into()),
    };
    let identifier = format!("com.leon.betterjira.{window}");
    let work = PathBuf::from(env::var("C1_IPC_TEST_ROOT")?).canonicalize()?;
    let home = work.join("home");
    let temporary = work.join("tmp");
    let state = work.join("data");
    let assets = work.join("dist");
    let jira_tls = window == "n25-ipc-fixture";
    let certs = work.join(
        if jira_tls || matches!(window, "n16-ipc-fixture" | "n17-ipc-fixture") {
            "tls/ca.pem"
        } else {
            "no-platform-trust.pem"
        },
    );
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
    if env::var_os("SSL_CERT_FILE").as_deref() != Some(certs.as_os_str())
        || env::var_os("SSL_CERT_DIR").is_some()
        || certs.canonicalize()? != certs
    {
        return Err("Fixture requires private TLS trust without access to the system store".into());
    }
    let port: u16 = env::var("C1_IPC_JIRA_PORT")?.parse()?;
    let canary: u16 = env::var("C1_IPC_CANARY_PORT")?.parse()?;
    if port == 0 || canary == 0 || port == canary {
        return Err("Fixture requires separate nonzero loopback ports".into());
    }
    let scheme = if jira_tls { "https" } else { "http" };
    let origin = format!("{scheme}://127.0.0.1:{port}");
    let scm_fixture = env::var("C1_IPC_SCM_FIXTURE").as_deref() == Ok("1");
    if scm_fixture {
        if !jira_tls {
            return Err("SCM fixture requires the private HTTPS CA in the fixture root".into());
        }
        SCM_TLS.set((port, reqwest::Certificate::from_pem(&fs::read(&certs)?)?))
            .map_err(|_| "SCM fixture trust already set")?;
    }
    if env::var("C1_IPC_SCM_HEADLESS").as_deref() == Ok("1") {
        if !scm_fixture {
            return Err("Headless SCM requires the isolated SCM fixture".into());
        }
        return tauri::async_runtime::block_on(scm_headless(&origin, state));
    }
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
    if scm_fixture {
        init.push_str(&format!("Object.defineProperty(window, '__C1_SCM_ORIGIN__', {{ value: {origin:?} }});"));
    }
    if window == "n02-ipc-fixture" {
        init.push_str("Object.defineProperty(window, '__N02_NATIVE_FIXTURE__', { value: true });");
    }
    if window == "n03-ipc-fixture" {
        init.push_str("Object.defineProperty(window, '__N03_NATIVE_FIXTURE__', { value: true });");
    }
    let builder = tauri::Builder::default().plugin(tauri_plugin_http::init());
    let builder = if matches!(window, "n16-ipc-fixture" | "n17-ipc-fixture") {
        let zammad: u16 = env::var("C1_IPC_ZAMMAD_PORT")?.parse()?;
        if zammad == 0 || zammad == port || zammad == canary {
            return Err("Zammad fixture requires a third distinct loopback port".into());
        }
        let ca = work.join("tls/ca.pem");
        if ca.canonicalize()? != ca {
            return Err("Zammad fixture CA must be inside its private root".into());
        }
        let root = reqwest::Certificate::from_pem(&fs::read(ca)?)?;
        ZAMMAD_TLS
            .set((zammad, root))
            .map_err(|_| "Zammad fixture trust already set")?;
        init.push_str(&format!(
            "window.__N17_ZAMMAD_ORIGIN__ = 'https://127.0.0.1:{zammad}';"
        ));
        builder.invoke_handler(tauri::generate_handler![
            super::session_get,
            super::session_set,
            super::session_delete,
            super::zammad::zammad_connection_get,
            super::zammad::zammad_connect,
            super::zammad::zammad_disconnect,
            super::zammad::zammad_request,
            fixture_finish,
        ])
    } else if scm_fixture {
        builder.invoke_handler(tauri::generate_handler![
            super::session_get,
            super::session_set,
            super::session_delete,
            fixture_finish,
            fixture_snapshot,
            super::scm::scm_request,
        ])
    } else if window == "n25-ipc-fixture" {
        builder.invoke_handler(tauri::generate_handler![
            super::session_get,
            super::session_set,
            super::session_delete,
            fixture_finish,
            fixture_snapshot,
        ])
    } else {
        builder.invoke_handler(tauri::generate_handler![
            super::session_get,
            super::session_set,
            super::session_delete,
            fixture_finish,
        ])
    };
    builder
        .setup(move |app| {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let data = app.path().app_data_dir()?;
            if !data.starts_with(&state) || !app.path().app_cache_dir()?.starts_with(&state) {
                return Err("Tauri resolved app data or cache outside the fixture root".into());
            }
            super::secrets::init(data.clone());
            if scm_fixture {
                super::scm::scm_token_set(SCM_FIXTURE_ID.into(), "fixture-scm-token".into(), format!("127.0.0.1:{port}"))?;
            }
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
