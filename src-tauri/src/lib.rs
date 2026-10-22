mod core;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

struct AppState {
    db: PathBuf,
    importing: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
    stream_filter: Mutex<core::Filter>,
}
#[tauri::command]
async fn get_stats(state: State<'_, AppState>) -> Result<core::Stats, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || core::stats(&db))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn query_events(
    state: State<'_, AppState>,
    filter: core::Filter,
) -> Result<core::Page, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || core::query(&db, &filter))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn get_event(state: State<'_, AppState>, id: i64) -> Result<core::Detail, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || core::detail(&db, id))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn set_bookmark(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || core::bookmark(&db, id, enabled))
        .await
        .map_err(|e| e.to_string())??;
    let _ = app.emit("workspace-changed", "bookmark");
    Ok(())
}
#[tauri::command]
async fn import_files(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<core::ImportReport, String> {
    if state.importing.swap(true, Ordering::SeqCst) {
        return Err("正在导入，请等待当前任务完成".into());
    }
    state.cancelled.store(false, Ordering::SeqCst);
    let db = state.db.clone();
    let importing = state.importing.clone();
    let cancelled = state.cancelled.clone();
    tauri::async_runtime::spawn_blocking(move || {
        struct Reset(Arc<AtomicBool>);
        impl Drop for Reset {
            fn drop(&mut self) {
                self.0.store(false, Ordering::SeqCst);
            }
        }
        let _reset = Reset(importing);
        let result = core::import(&db, paths, &cancelled, |p| {
            let _ = app.emit("import-progress", p);
        });
        let _ = app.emit("workspace-changed", "import");
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn cancel_import(state: State<'_, AppState>) {
    state.cancelled.store(true, Ordering::SeqCst);
}
#[tauri::command]
async fn open_event_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    filter: core::Filter,
) -> Result<(), String> {
    *state.stream_filter.lock().map_err(|e| e.to_string())? = filter.clone();
    if let Some(window) = app.get_webview_window("event-stream") {
        app.emit_to("event-stream", "stream-navigate", &filter)
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.unminimize().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        WebviewWindowBuilder::new(&app, "event-stream", WebviewUrl::App("index.html".into()))
            .title("AuraEVTX — 独立事件流")
            .inner_size(1600.0, 1000.0)
            .min_inner_size(1060.0, 720.0)
            .maximized(true)
            .build()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn get_stream_filter(state: State<'_, AppState>) -> Result<core::Filter, String> {
    Ok(state
        .stream_filter
        .lock()
        .map_err(|e| e.to_string())?
        .clone())
}
#[tauri::command]
fn focus_main(app: tauri::AppHandle, view: String) -> Result<(), String> {
    if !["overview", "catalog", "settings"].contains(&view.as_str()) {
        return Err("无效视图".into());
    }
    let window = app.get_webview_window("main").ok_or("主窗口不可用")?;
    app.emit_to("main", "main-navigate", view)
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
async fn export_csv(
    state: State<'_, AppState>,
    filter: core::Filter,
    path: String,
) -> Result<u64, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || core::export(&db, &filter, &PathBuf::from(path)))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
fn open_reference(url: String) -> Result<(), String> {
    if !core::catalog().iter().any(|d| d.source == url) {
        return Err("只能打开事件字典中收录的文档链接".into());
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        use std::os::windows::process::CommandExt;
        let mut command = std::process::Command::new("rundll32.exe");
        command.args(["url.dll,FileProtocolHandler", &url]);
        command.creation_flags(0x08000000);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut c = std::process::Command::new("open");
        c.arg(&url);
        c
    };
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut command = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(&url);
        c
    };
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = dir.join("aura.db");
            core::initialize(&db).map_err(std::io::Error::other)?;
            app.manage(AppState {
                db,
                importing: Arc::new(AtomicBool::new(false)),
                cancelled: Arc::new(AtomicBool::new(false)),
                stream_filter: Mutex::new(core::Filter {
                    page_size: 50,
                    ascending: true,
                    ..Default::default()
                }),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_stats,
            query_events,
            get_event,
            set_bookmark,
            import_files,
            open_event_window,
            get_stream_filter,
            focus_main,
            cancel_import,
            export_csv,
            open_reference
        ])
        .run(tauri::generate_context!())
        .expect("AuraEVTX 启动失败");
}
