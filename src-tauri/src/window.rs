use tauri::{App, Manager, WebviewWindow};

/// 配置主窗口：置顶、无边框、透明。窗口尺寸=宠物大小，正常接收鼠标事件
/// （透明区域外无内容，等效不挡桌面操作）。
pub fn configure_main_window(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(true).ok();
    }
    Ok(())
}

/// 开始拖拽窗口（mousedown 命中宠物时由前端直接调用）
#[tauri::command]
pub fn start_drag(window: WebviewWindow) {
    window.start_dragging().ok();
}

/// 开机自启开关：enable=true 注册自启，false 取消。
/// 依赖 tauri-plugin-autostart；失败（如 macOS 未授权）静默忽略。
#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enable: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    let result = if enable {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(e) = result {
        eprintln!("set_autostart({enable}) failed: {e}");
    }
}

/// 打开设置窗口（不存在则无操作）
#[tauri::command]
pub fn open_settings(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
