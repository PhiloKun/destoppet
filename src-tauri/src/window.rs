use tauri::{App, Manager, WebviewWindow};

/// 配置主窗口：铺满屏幕工作区、置顶、点击穿透（不拦截鼠标）
pub fn configure_main_window(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        setup_window(&window)?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn setup_window(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // macOS：置顶 + 点击穿透（宠物不挡操作）
    window.set_always_on_top(true).ok();
    window.set_ignore_cursor_events(true).ok();
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn setup_window(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    window.set_always_on_top(true).ok();
    window.set_ignore_cursor_events(true).ok();
    Ok(())
}

/// 开关点击穿透：true=穿透（不挡操作），false=可接收鼠标事件（用于拖拽）
#[tauri::command]
pub fn set_cursor_ignore(window: WebviewWindow, ignore: bool) {
    window.set_ignore_cursor_events(ignore).ok();
}

/// 开始拖拽窗口（需先关闭穿透，见 set_cursor_ignore(false)）
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
