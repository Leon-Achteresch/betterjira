#[cfg(target_os = "macos")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    betterjira_lib::c1_ipc_fixture::run()
}

#[cfg(not(target_os = "macos"))]
fn main() {
    panic!("C1 IPC fixture requires macOS");
}
