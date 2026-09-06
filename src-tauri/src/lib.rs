use serde::Serialize;

/// Jcode compatibility boundary (Backend Milestone One): version pinning,
/// release verification, and the harness-API protocol contract. Not yet
/// surfaced through Tauri commands — that wiring is Milestone Three.
pub mod jcode;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Coding Studio".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Boots the desktop shell.
///
/// The agent runtime is currently mocked in the frontend, so no provider
/// process is supervised here yet. The future Jcode supervisor will be
/// introduced behind this same command boundary.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running Coding Studio");
}
