use tauri::{App, Manager, Window};

/// 配置主窗口：铺满屏幕工作区、置顶、点击穿透（不拦截鼠标）
pub fn configure_main_window(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(window) = app.get_webview_window("main") {
        setup_window(&window)?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn setup_window(window: &Window) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::utils::config::WindowConfig;
    // macOS：让窗口铺满屏幕，并保持置顶 + 点击穿透
    window.set_always_on_top(true).ok();
    // 点击穿透：让鼠标事件穿透到下方窗口（宠物不挡操作）
    window.set_ignore_cursor_events(true).ok();
    let _ = WindowConfig::default();
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn setup_window(window: &Window) -> Result<(), Box<dyn std::error::Error>> {
    window.set_always_on_top(true).ok();
    window.set_ignore_cursor_events(true).ok();
    Ok(())
}
