pub mod ollama;

use std::sync::Arc;

use serde::Serialize;

use ollama::{OllamaState, SharedOllamaState};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state: SharedOllamaState = Arc::new(OllamaState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            app_info,
            ollama::ollama_health,
            ollama::ollama_models,
            ollama::ollama_endpoint,
            ollama::ollama_set_endpoint,
            ollama::ollama_chat,
            ollama::ollama_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Coding Studio");
}
