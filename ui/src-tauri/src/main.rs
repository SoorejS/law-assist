// Prevents extra console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, State};

/// Holds the Python engine child process so we can kill it on exit.
struct EngineProcess(Mutex<Option<std::process::Child>>);

/// Tauri command exposed to the frontend — returns the engine API port.
#[tauri::command]
fn engine_port() -> u16 {
    8765
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineProcess(Mutex::new(None)))
        .setup(|app| {
            let engine_dir = find_engine_dir(app);
            match engine_dir {
                Some(dir) => {
                    eprintln!("[saravonix] Starting engine from {:?}", dir);
                    let python = if cfg!(target_os = "windows") {
                        "python"
                    } else {
                        "python3"
                    };

                    let py_sub = if cfg!(target_os = "windows") {
                        "Scripts/python.exe"
                    } else {
                        "bin/python3"
                    };
                    let venv_python = if dir.join(".venv").join(py_sub).exists() {
                        dir.join(".venv").join(py_sub)
                    } else if dir.join(".venv_312").join(py_sub).exists() {
                        dir.join(".venv_312").join(py_sub)
                    } else {
                        std::path::PathBuf::from(python)
                    };
                    let python_bin = venv_python.to_string_lossy().to_string();

                    match std::process::Command::new(&python_bin)
                        .arg("api.py")
                        .current_dir(&dir)
                        .spawn()
                    {
                        Ok(child) => {
                            let state: State<EngineProcess> = app.state();
                            *state.0.lock().unwrap() = Some(child);
                            eprintln!("[saravonix] Engine process started");
                        }
                        Err(e) => {
                            eprintln!(
                                "[saravonix] Could not start engine ({e}). \
                                 Run `python api.py` manually in the engine/ directory."
                            );
                        }
                    }
                }
                None => {
                    eprintln!(
                        "[saravonix] Engine directory not found. \
                         Run `python api.py` manually in the engine/ directory."
                    );
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the Python engine when the window is closed
                if let Some(state) = window.try_state::<EngineProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            eprintln!("[saravonix] Engine process terminated");
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![engine_port])
        .run(tauri::generate_context!())
        .expect("error while running Saravonix application");
}

/// Locate the engine/ directory relative to the app or executable.
fn find_engine_dir(app: &tauri::App) -> Option<std::path::PathBuf> {
    // Dev mode: engine/ is a sibling of ui/
    let candidates = vec![
        // When running `cargo tauri dev` from ui/
        std::env::current_dir()
            .ok()?
            .parent()
            .map(|p| p.join("engine")),
        // When the binary is in ui/src-tauri/target/...
        std::env::current_exe()
            .ok()
            .and_then(|p| {
                p.ancestors()
                    .find(|a| a.ends_with("saravonix-chatbot"))
                    .map(|root| root.join("engine"))
            }),
        // App resource dir (bundled production build — Phase 2)
        app.path().resource_dir().ok().map(|d| d.join("engine")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.join("api.py").exists() {
            return Some(candidate);
        }
    }
    None
}
