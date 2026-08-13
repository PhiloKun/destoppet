use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager,
};

/// 创建系统托盘 + 右键菜单
pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let follow = MenuItem::with_id(app, "toggle_follow", "跟随鼠标：开", true, None::<&str>)?;
    let autostart = MenuItem::with_id(app, "toggle_autostart", "开机自启：关", true, None::<&str>)?;
    let mute = MenuItem::with_id(app, "toggle_mute", "声音：开", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &settings, &follow, &autostart, &mute, &quit])?;

    let _tray = TrayIconBuilder::with_id("mochi-tray")
        .tooltip("DestopPet")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "settings" => {
                crate::window::open_settings(app.clone());
            }
            "toggle" => {
                if let Some(w) = app.get_webview_window("main") {
                    let visible = w.is_visible().unwrap_or(false);
                    if visible {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                    }
                }
            }
            // 设置类：发事件给前端，由前端更新 store 与系统能力
            "toggle_follow" | "toggle_autostart" | "toggle_mute" => {
                let _ = app.emit("config-toggle", event.id().as_ref().to_string());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let visible = w.is_visible().unwrap_or(false);
                    if visible {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
