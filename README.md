# Mochi 桌面桌宠

跨平台（Windows + macOS）桌面宠物，基于 **Tauri 2** + 原生 **Canvas** 实现。
宠物常驻桌面，可走动、待机、打盹、看向鼠标，通过系统托盘控制。

## 环境要求

- Node.js ≥ 18（开发已验证 v26）
- **Rust 工具链（必需，用于编译 Tauri 后端）**

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- macOS 额外：`xcode-select --install`

## 快速开始

```bash
npm install          # 安装前端依赖
npm run tauri dev    # 启动开发模式（会编译 Rust 并打开窗口）
```

> 首次 `tauri dev` 会下载并编译 Rust 依赖，耗时较长，请耐心等待。

## 构建安装包

```bash
npm run tauri build  # 产物在 src-tauri/target/release/bundle/
```

- macOS：生成 `.app` / `.dmg`（已验证）
- Windows：需在 Windows 环境 / CI 打包生成 `.exe` / `.msi`
- CI 自动打包：`.github/workflows/build.yml`，打 `v*` tag 或手动触发，
  artifact 产出 macos `.dmg` 与 windows `.msi`

## 功能

- 宠物状态：走动 / 待机眨眼 / 打盹(Zzz) / 看向鼠标 / 点击开心一跳
- 透明置顶窗口，尺寸贴合宠物，每帧跟随移动（透明区外不挡桌面操作）
- 拖拽移动宠物、点击触发反馈动画
- 系统托盘：显示/隐藏、设置、跟随鼠标、开机自启、声音、退出
- 独立设置窗口（托盘「设置」打开），配置本地持久化

## 项目结构

```
src/                 前端（Canvas 动画 + 状态机）
  main.js            入口：主循环 + 交互 + 托盘事件
  settings.js        设置窗口逻辑
  core/Pet.js        宠物状态机（WALK/IDLE/SLEEP/LOOK/HAPPY）
  core/Config.js     设置读写（封装 tauri store）
  core/Loop.js       主循环
  render/Renderer.js Canvas 渲染器（DPI 适配）
src-tauri/           Rust 后端（窗口/托盘）
  src/window.rs      窗口配置 + 手动拖拽/开机自启/打开设置 命令
  src/tray.rs        系统托盘 + 右键菜单
docs/design.md       方案设计文档
```

## 当前进度

- [x] P0 项目骨架 + 透明置顶窗口配置
- [x] P1 占位宠物动画（程序化绘制）+ 主循环
- [x] P2 状态机补全（WALK/IDLE/SLEEP/LOOK）+ 随机切换
- [x] P3 手动拖拽（setPosition 跟随）+ 点击反馈（开心一跳）
- [x] P4 托盘菜单 + 设置窗口 + 本地存储 + 开机自启
- [x] P5 双平台打包（macOS 实测 / Windows CI）

详见 `docs/design.md`。
