use serde::Serialize;
use tauri::ipc::Channel;
use tauri_plugin_updater::UpdaterExt;

const RELEASE_MANIFEST: &str = "https://github.com/Leon-Achteresch/betterjira/releases/download/v{version}/latest.json";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

fn valid_version(version: &str) -> bool {
    !version.is_empty() && version.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

#[tauri::command]
pub async fn update_install_version(app: tauri::AppHandle, version: String, on_progress: Channel<Progress>) -> Result<(), String> {
    if !valid_version(&version) {
        return Err(format!("Ungültige Version: {version}"));
    }
    let endpoint = RELEASE_MANIFEST.replace("{version}", &version).parse().map_err(|e| format!("{e}"))?;
    let update = app
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .version_comparator(|_, _| true)
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Version {version} nicht gefunden"))?;
    let mut downloaded = 0u64;
    update
        .download_and_install(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = on_progress.send(Progress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::valid_version;

    #[test]
    fn rejects_url_injection() {
        assert!(valid_version("0.6.0"));
        assert!(valid_version("1.0.0-beta.1"));
        assert!(!valid_version(""));
        assert!(!valid_version("0.6.0/../x"));
        assert!(!valid_version("0.6.0?a=b"));
    }
}
