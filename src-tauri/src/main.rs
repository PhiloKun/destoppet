// 预构建入口（桌面端）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mochi_lib::run();
}
