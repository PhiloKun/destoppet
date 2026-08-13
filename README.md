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

- macOS：生成 `.app` / `.dmg`
- Windows：需在 Windows 环境 / CI 打包生成 `.exe` / `.msi`

## 项目结构

```
src/                 前端（Canvas 动画 + 状态机）
  core/Pet.js        宠物状态机（WALK/IDLE/SLEEP/LOOK）
  core/Loop.js       主循环
  render/Renderer.js Canvas 渲染器（DPI 适配）
src-tauri/           Rust 后端（窗口/托盘）
docs/design.md       方案设计文档
```

## 当前进度

- [x] P0 项目骨架 + 透明置顶窗口配置
- [x] P1 占位宠物动画（程序化绘制）+ 主循环
- [x] P2 状态机补全（WALK/IDLE/SLEEP/LOOK）+ 随机切换
- [x] P3 点击穿透 + 拖拽 + 点击反馈（开心一跳）
- [x] P4 托盘菜单（显示/隐藏/设置）+ 本地存储 + 开机自启
- [ ] P5 双平台打包

详见 `docs/design.md`。
