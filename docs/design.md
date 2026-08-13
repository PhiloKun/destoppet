# 桌面桌宠（Desktop Pet）方案设计文档

> 版本：v1.0 · 更新日期：2026-08-13
> 状态：设计阶段（待评审后进入实现）

---

## 1. 项目概述

一款跨平台（Windows + macOS）桌面宠物应用。宠物以透明无边框窗口常驻桌面，具备
走路、随机待机、打盹、眨眼、看向鼠标等陪伴型行为，通过系统托盘控制。

**本期目标（MVP）**：跑通"可爱跟随/挂机"核心玩法 —— 宠物在桌面走动、随机动作、
空闲打盹、看向鼠标；透明置顶窗口（窗口=宠物，手动拖拽跟随）、托盘菜单、轻量本地存储。

---

## 2. 技术选型

| 维度 | 选型 | 理由 |
|------|------|------|
| 框架 | **Tauri 2.x** | 一套代码跨 Windows/macOS；安装包体积小（对比 Electron 小一个量级）；原生支持透明无边框窗口、置顶、托盘、开机自启 |
| 前端 | **原生 JS + Canvas** | 零依赖、轻量、启动快；精灵帧动画用手写 Canvas 循环最合适 |
| 后端语言 | **Rust** | Tauri 标配，处理系统级能力 |
| 打包 | `tauri build`（各平台 CI 分别打包） | — |
| 存储 | Tauri **store**（本地 JSON） | 记住窗口位置、设置开关，成本极低 |
| 素材 | **Kenney.nl 像素素材（CC0 免授权）**占位 | 免费可商用；后续可替换为 Live2D |

### 2.1 环境前置要求（实现前必须）
- Node.js ≥ 18（当前已装 v26.6.0 ✅）
- **Rust 工具链（cargo / rustc）** —— 当前**未安装**，需执行：
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- macOS 需装 Xcode 命令行工具：`xcode-select --install`
- Windows 打包需在 Windows 环境 / CI 完成

---

## 3. 目录结构

```
mochi/
├── docs/
│   └── design.md                 # 本文档
├── src/                          # 前端（原生 JS + Canvas）
│   ├── index.html                # 透明全屏画布宿主
│   ├── styles.css                # 透明、无边框、置顶样式
│   ├── main.js                   # 入口：初始化、主循环
│   ├── core/
│   │   ├── Pet.js                # 宠物状态机（走/停/睡/看鼠标）
│   │   ├── Sprite.js             # 精灵帧动画播放器
│   │   ├── Loop.js               # requestAnimationFrame 主循环
│   │   └── Config.js             # 设置读写（封装 tauri store）
│   ├── render/
│   │   └── Renderer.js           # Canvas 绘制、DPI 适配
│   └── assets/
│       └── pet/                  # 占位像素素材（精灵图）
│           ├── walk.png
│           ├── idle.png
│           └── sleep.png
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json           # 窗口透明/置顶（64×64，手动跟随）配置
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── tray.rs               # 系统托盘 + 右键菜单
│       └── window.rs             # 透明、置顶、手动拖拽、开机自启
├── package.json                  # 前端脚本 + tauri cli
├── README.md
└── .gitignore
```

---

## 4. 核心设计

### 4.1 窗口特性（Tauri 配置）
- `transparent: true` + `decorations: false`：透明无边框
- `alwaysOnTop: true`：置顶（宠物不挡操作但可见）
- `contentProtected: false`、`skipTaskbar: true`：不在任务栏显示
- **窗口尺寸 = 宠物大小（64×64）**：窗口本身就是宠物，正常接收鼠标事件；
  透明区域外无内容，故不挡桌面操作，**无需点击穿透**（`ignoreCursorEvents` 已弃用）。
  宠物坐标即窗口在屏幕上的位置，每帧 `setPosition` 跟随移动（详见 4.4 / 7.4）。

### 4.2 宠物状态机（Pet.js）
```
        ┌─────────┐   空闲超时   ┌─────────┐
        │  WALK   │ ───────────▶ │  IDLE   │
        │ (走动)  │              │ (待机)  │
        └─────────┘ ◀─────────── └─────────┘
             │  ▲                     │  ▲
        随机  │  │ 继续走            长时间 │  │ 被唤醒
             ▼  │                     ▼  │
        ┌─────────┐   被唤醒   ┌─────────┐
        │  SLEEP  │ ◀──────── │  LOOK   │ 看向鼠标
        │ (打盹)  │           │ (注视)  │
        └─────────┘           └─────────┘
```
状态：`WALK`（左右走动）/ `IDLE`（随机抖动、眨眼）/ `SLEEP`（打盹 Zzz）/
`LOOK`（头部转向鼠标方向）。由主循环按概率与时间阈值切换。

### 4.3 精灵动画（Sprite.js）
- 每张精灵图按固定帧宽高切分，按 FPS 顺序播放
- 朝向翻转用 `ctx.scale(-1,1)` 实现左右走
- 眨眼 / 打盹为独立短动画叠加

### 4.4 交互
- 窗口尺寸 = 宠物（64×64），正常接收鼠标，透明区外无内容故不挡桌面操作。
- **拖拽（手动跟随）**：按住宠物，`mousemove` 时用鼠标位移 delta 直接
  `setPosition(起点窗口位置 + delta)` 移动窗口（逻辑坐标）。macOS 上透明无边框窗的
  `startDragging()` 经常失效，故采用手动跟随方案，跨平台可靠。
- **点击**：鼠标几乎未移动（<4px）则播放"开心一跳"反馈动画（HAPPY 状态）。
- 鼠标靠近：进入 `LOOK` 状态，朝鼠标方向。

### 4.5 系统托盘（tray.rs）
- 托盘图标常驻
- 右键菜单：`显示/隐藏`、`设置（跟随开关、音量）`、`退出`
- 单击托盘：切换显示

### 4.6 本地存储（Config.js + store）
存储：`窗口位置`、`是否跟随鼠标`、`是否开机自启`、`静音`。
启动时读取恢复，变更时写入。

---

## 5. 实现计划（分阶段）

| 阶段 | 内容 | 产出 | 状态 |
|------|------|------|------|
| P0 | 安装 Rust 工具链；`npm create tauri-app` 初始化；配置透明置顶窗口 | 空白透明窗口能跑 | ✅ 已完成 |
| P1 | 占位宠物 + Renderer + 主循环；实现 WALK/IDLE 动画 | 宠物能走动待机 | ✅ 已完成（程序化绘制） |
| P2 | 状态机补全 SLEEP / LOOK；随机切换逻辑 | 完整陪伴行为 | ✅ 已完成 |
| P3 | 拖拽 + 点击反馈交互（窗口跟随宠物，直接拖拽） | 可互动 | ✅ 已完成 |
| P4 | 托盘菜单 + 设置面板 + 本地存储 | 可控可配置 | ✅ 已完成 |
| P5 | Windows/macOS 打包脚本 + README；双平台自测 | 可分发安装包 | ✅ 已完成（macOS 实测出包；Windows 走 CI） |

> 注：原计划 P1 使用 Kenney 像素精灵图（`Sprite.js` + `assets/pet/*.png`），
> 实际实现改为**程序化 Canvas 绘制**（圆角方块 + 眼睛 + Zzz），免去素材依赖、
> 更快跑通核心玩法。`Sprite.js` 暂未创建，待替换真实素材时再补。详见第 10 章。

---

## 6. 风险与备注
- **Rust 工具链**：P0 前置，约 2–5 分钟安装 + 编译工具链（当前已安装 ✅）。
- macOS 上 Tauri 透明窗口在部分桌面环境下边缘可能有 1px 描边，需实测。
- 开机自启在 macOS 需处理权限弹窗；Windows 通过注册表/启动文件夹实现。
- 素材为占位 CC0 资源，后续替换 Live2D 需引入 `live2d` 相关渲染（不在本期）。
- 交互模型：窗口尺寸=宠物（透明无边框，64×64），正常接收鼠标；每帧 `setPosition`
  跟随宠物移动，透明区外无内容故不挡桌面操作，无需 ignoreCursorEvents 穿透。
- 拖拽采用手动 `setPosition` 跟随（窗口起点位置 + 鼠标位移 delta），跨平台稳定；
  不使用 `startDragging()`（macOS 透明无边框窗下经常失效）。

---

## 7. 前端模块实现细节（当前）

### 7.1 主循环 `core/Loop.js`
`requestAnimationFrame` 驱动，每帧计算 `dt`（并 clamp 到最大 50ms，防止后台标签页
恢复时跳变），回调 `onFrame(dt, now)`。暴露 `start()/stop()`。

### 7.2 渲染器 `render/Renderer.js`
- 窗口尺寸固定为宠物大小（`size=64`，构造时传入），canvas 像素按 `devicePixelRatio`
  设置（`w*dpr`），`ctx.setTransform(dpr,0,0,dpr,0,0)` 做 DPI 适配。
- `clear()` 用 `clearRect` 清空（透明背景保留），宠物绘制于窗口内 `(0,0)`。

### 7.3 宠物状态机 `core/Pet.js`
- `x/y` 现为**窗口在屏幕上的位置**（逻辑像素）；宠物绘制固定在窗口内 `(0,0)`，
  窗口每帧 `setPosition(new LogicalPosition(x, y))` 跟随宠物移动（见 7.4）。
  ⚠️ Tauri 2 的 `setPosition` 只接受 **Position 对象**（如 `new LogicalPosition(x,y)`），
  直接传两个数字 `(x, y)` 会静默失败，导致窗口完全不动（拖拽/跟随均失效）。
- 字段：`size=64`、`dir`（朝向 1 右 / -1 左）、`state`、`stateTime`、
  `nextThink`、`blink`、`lookTargetX`（LOOK 注视目标，用全局 `mouse.x` 与 `centerX()` 比较）。
- 出生贴底：`y = screen.height - size`；水平边界 `[0, screen.width - size]`。
- 切换逻辑（见 4.2 状态图），核心参数：
  - WALK 速度 `0.06 px/ms`；走到边界反弹换向。
  - IDLE 时鼠标在 ±200px 内 → `LOOK`；否则按随机进入 WALK(60%) / SLEEP(40%)。
  - SLEEP 持续 `4–7s` 后回 IDLE。
  - LOOK 鼠标离开 ±260px 后回 IDLE。
  - 眨眼：随机触发，单次 120ms（`blink=120`）。
- 绘制（`draw(ctx)`）：圆角方块身体 + 摆动脚（WALK 时 `sin` 摆动）+ 眼睛
  （眨眼变横线 / LOOK 时偏移 3px）+ SLEEP 时上浮渐隐的 "z"。

### 7.4 入口与交互 `src/main.js`
- 初始化 Renderer(64) / Pet / Loop / Config。
- 主循环每帧：`pet.update` 后调用 `followWindow()`，仅在位置变化 >1px 时
  `win.setPosition(pet.x, pet.y)`（去抖，避免每帧 IPC）；`win` 句柄预热缓存。
- 全局 `mousemove` 收集鼠标坐标喂状态机（LOOK 注视）。
- **拖拽 + 点击反馈**（窗口尺寸=宠物，正常接收鼠标事件，透明区外无内容故不挡桌面）：
  - `mousedown`：记录鼠标相对窗口坐标 + 当前窗口逻辑位置（`outerPosition`），`pressing=true`。
  - `mousemove`：`pressing` 且移动超过 `DRAG_THRESHOLD=4px` 判定拖拽，`dragging=true`、
    宠物切 IDLE；拖拽中每帧 `pet.x/y = 拖拽起点窗口位置 + 鼠标位移 delta` 并
    `setPosition` 跟随（手动方案，macOS 透明窗稳定）。
  - `mouseup`：未移动（点击）→ `pet.triggerHappy()` 播放开心一跳；拖拽结束复位标记。
  - 非 Tauri 环境（纯浏览器预览）静默忽略 Tauri API。
- `dragging` 中暂停 `pet.update`（不走动），窗口位置由手动 `setPosition` 实时跟随。
- **配置恢复**：启动时 `config.ready()` 后按 `autostart` 调 `set_autostart` 命令；
  监听托盘 `config-toggle` 事件，切换 `followMouse/muted/autostart` 并持久化到 store。

### 7.5 设置与存储 `core/Config.js` + `src-tauri/src/window.rs`
- `Config` 封装 Tauri `plugin-store`（`mochi.json`，`autoSave`），键：
  `followMouse`（跟随鼠标）、`muted`（静音）、`autostart`（开机自启）。
- 托盘菜单项 `toggle_follow` / `toggle_autostart` / `toggle_mute` 由 Rust `emit`
  `"config-toggle"` 事件到前端，前端 `onConfigToggle` 翻转对应键并写回 store；
  `autostart` 变更额外 `invoke("set_autostart", {enable})`。
- Rust 命令 `set_autostart(app, enable)` 使用 `tauri-plugin-autostart` 的
  `app.autolaunch().enable()/disable()`，失败静默忽略（macOS 未授权等）。

---

## 8. Rust 后端实现细节（当前）

### 8.1 模块划分 `src/lib.rs`
- 注册 `tauri_plugin_store` 与 `tauri_plugin_autostart`。
- `setup` 中依次：`window::configure_main_window` 配置透明置顶窗口、
  `tray::create_tray` 建托盘。
- 暴露命令：`window::start_drag`（兜底，前端现用 JS `setPosition` 手动拖拽）、
  `window::set_autostart`、`window::open_settings`。

### 8.2 窗口 `src/window.rs`
- `configure_main_window`：取 id=`main` 的窗口设 `always_on_top`（无边框透明，
  正常接收鼠标，由前端 `setPosition` 跟随宠物移动）。
- 命令 `start_drag(window)`：调用 `start_dragging()` 移交系统拖拽（兜底；前端当前
  用 `setPosition` 手动跟随，规避 macOS 透明窗 `startDragging()` 失效）。

### 8.3 托盘 `src/tray.rs`
- 右键菜单：`显示/隐藏`（toggle）、`退出`（quit）。
- `show_menu_on_left_click(false)`：左键点击不弹菜单。
- 左键单击托盘（`TrayIconEvent::Click` Left+Up）== 显示/隐藏切换。
- 菜单含：`显示/隐藏`、`设置`、`跟随鼠标`、`开机自启`、`声音`、`退出`。
- `跟随/开机自启/声音` 三项通过 `app.emit("config-toggle", key)` 通知前端翻转并持久化；
  `设置` 项调 `window::open_settings` 打开独立设置窗口。

### 8.4 窗口配置 `tauri.conf.json`
- `windows[0]`（label=`main`）：`width/height=64`（窗口=宠物，正常接收鼠标，
  由前端每帧 `setPosition` 跟随），`resizable=false`，`transparent=true`，
  `decorations=false`，`alwaysOnTop=true`，`skipTaskbar=true`。
- `windows[1]`（label=`settings`）：普通窗口（`transparent=false`），
  `visible=false` 默认隐藏，`center=true`，托盘"设置"打开。
- `app.macOSPrivateApi=true`（透明窗口必需）；`security.csp=null`（开发期宽松）。

### 8.5 设置窗口（独立 UI）
- 入口：`settings.html` + `src/settings.js` + `src/settings.css`（Vite 多页，
  `rollupOptions.input` 含 `main`/`settings`）。
- 三个开关：**跟随鼠标 / 开机自启 / 静音**，读写 `Config`（store）。
- `开机自启` 变更额外 `invoke("set_autostart", {enable})`。
- `open_settings` 命令（`window.rs`）`show` + `set_focus` 该窗口；关闭按钮 `hide`。
- 与托盘开关共享同一份 `Config` 存储，状态一致。

---

## 9. 前端 ↔ Rust 通信契约

| 前端调用 | Rust 命令 | 方向 | 用途 |
|----------|-----------|------|------|
| `getCurrentWindow().setPosition(x,y)` | （Tauri 内置） | JS→窗口 | 拖拽/跟随时移动窗口（手动） |
| `getCurrentWindow().outerPosition()` | （Tauri 内置） | JS→窗口 | 读当前窗口位置作为拖拽起点 |
| `invoke("start_drag")` | `start_drag` | JS→Rust | 兜底：系统级窗口拖拽（前端现用 setPosition） |
| `invoke("set_autostart", {enable})` | `set_autostart` | JS→Rust | 开关开机自启 |
| `invoke("open_settings")` | `open_settings` | JS→Rust | 打开独立设置窗口 |

> 交互模型为"窗口=宠物（64×64）+ 手动 setPosition 跟随"，已弃用点击穿透
> （`ignoreCursorEvents`）与 `startDragging()` 系统托拽（macOS 透明窗失效）。

---

## 10. 占位宠物绘制说明（替代 Sprite 素材）

原计划 `Sprite.js` + `assets/pet/*.png` 精灵图方案在 MVP 阶段以**程序化 Canvas 绘制**
替代，理由：
- 零素材依赖、启动即可见，最快验证状态机与主循环。
- 绘制逻辑集中在 `Pet.draw()`，形象可随时替换为 `Sprite.js` 精灵帧播放器。

后续切换真实素材时：`Pet.draw()` 改为调用 `Sprite` 按当前 `state` 取帧绘制，
状态机与外层接口不变，对 `main.js` / `window.rs` 无影响。

---

## 11. 待确认 / 后续可扩展
- [x] **P3 点击反馈**：点击宠物播放"开心一跳"短动画（HAPPY 状态）。✅
- [x] **P4 设置面板 + 本地存储**：`Config.js`（封装 tauri store）已完成，含
      跟随开关、静音、开机自启读写与启动恢复。✅
- [x] **P4 托盘"设置"项**：`tray.rs` 菜单已加 跟随/开机自启/声音 切换项。✅
- [x] **开机自启**：通过 `tauri-plugin-autostart` 实现（macOS LaunchAgent /
      Windows 注册表，由插件托管）。✅
- [x] **独立设置窗口 UI**：`settings.html` + `src/settings.js` + `open_settings`
      命令，托盘"设置"打开，与托盘开关共享 Config。✅
- [x] **P5 双平台打包**：macOS 本地 `tauri build` 已出 `.app`/`.dmg`；
      Windows 经 GitHub Actions CI（`build.yml`）出 `.msi`。✅
- [ ] 是否做更强互动反馈：拖拽抛出、喂食道具。
- [ ] 是否接入 AI 对话 / 桌面挂件（时钟、待办）。
- [ ] Live2D 形象替换时间点（替换 `Pet.draw` 为精灵/Live2D 渲染）。
- [ ] Windows 平台真机实测：透明窗口 + 穿透 + 托盘在 Windows 下的表现
      （当前仅能保证配置正确，未在本机 Windows 运行验证）。

---

## 12. 打包与双平台说明

### 12.1 本地构建
```bash
npm install
npm run tauri build      # 产物在 src-tauri/target/release/bundle/
```
- macOS：`.app` + `.dmg`（已验证，aarch64）。
- Windows：需在 Windows 环境 / CI 打包，产出 `.msi` / `.exe`。

### 12.2 CI 自动打包
`.github/workflows/build.yml`：
- `build-macos`：macOS runner 出 `dmg` 产物。
- `build-windows`：Windows runner 出 `msi` 产物。
- 触发：`push` 打 `v*` tag，或手动 `workflow_dispatch`。
  产物以 artifact 形式上传，可下载分发。

### 12.3 跨平台注意
- 透明无边框窗口：macOS 需 `macOSPrivateApi=true`；Windows 由 wry 原生支持。
- 拖拽：采用 `setPosition` 手动跟随方案；`startDragging()` 在 macOS 透明无边框窗下
  失效，已弃用。点击穿透（`ignoreCursorEvents`）因窗口=宠物尺寸而无需使用。
- 开机自启：`tauri-plugin-autostart` 自动处理 macOS LaunchAgent / Windows 注册表。
- 托盘：`tray-icon` 特性两平台均启用；Windows 托盘右键菜单行为一致。
