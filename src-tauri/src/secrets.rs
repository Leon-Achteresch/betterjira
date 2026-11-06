use std::fs;
use std::io::{ErrorKind, Write};
use std::path::PathBuf;
use std::sync::OnceLock;

static DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn init(dir: PathBuf) {
    let _ = DIR.set(dir.join("secrets"));
}

fn path(key: &str) -> Result<PathBuf, String> {
    let name: String = key.bytes().map(|b| format!("{b:02x}")).collect();
    DIR.get()
        .map(|dir| dir.join(name))
        .ok_or_else(|| "Speicherort für Zugangsdaten fehlt".to_string())
}

pub fn get(key: &str) -> Result<Option<String>, String> {
    match fs::read_to_string(path(key)?) {
        Ok(value) => Ok(Some(value)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn set(key: &str, value: &str) -> Result<(), String> {
    let target = path(key)?;
    let dir = target.parent().ok_or("Ungültiger Speicherort")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let temp = target.with_extension("tmp");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    let mut file = options.open(&temp).map_err(|e| e.to_string())?;
    file.write_all(value.as_bytes()).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    fs::rename(&temp, &target).map_err(|e| e.to_string())
}

pub fn delete(key: &str) -> Result<(), String> {
    match fs::remove_file(path(key)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        init(std::env::temp_dir().join(format!("betterjira-secrets-{}", std::process::id())));
        let key = "scm-gh:github.com/../x";
        assert_eq!(get(key).unwrap(), None);
        set(key, "one").unwrap();
        set(key, "two").unwrap();
        assert_eq!(get(key).unwrap().as_deref(), Some("two"));
        assert!(path(key).unwrap().starts_with(DIR.get().unwrap()));
        delete(key).unwrap();
        delete(key).unwrap();
        assert_eq!(get(key).unwrap(), None);
    }
}
