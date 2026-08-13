pub mod tray;
pub mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            // 创建透明置顶窗口并配置点击穿透
            window::configure_main_window(app)?;
            // 系统托盘
            tray::create_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window::set_cursor_ignore,
            window::start_drag,
            window::set_autostart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
