import { Pet, State } from "./core/Pet.js";
import { Loop } from "./core/Loop.js";
import { Renderer } from "./render/Renderer.js";
import { Config } from "./core/Config.js";

// 前端运行时错误兜底：转发到 Rust 控制台，便于 dev 模式排查
window.addEventListener("error", (e) => {
  // 在 Tauri 中可用 console，Rust 端 dev 会打印 WebView 日志
  console.error("[mochi-frontend-error]", e.message, e.filename, e.lineno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[mochi-frontend-rejection]", e.reason);
});

const canvas = document.getElementById("stage");
const renderer = new Renderer(canvas, 64); // 窗口尺寸=宠物大小
const pet = new Pet({ width: window.screen.width, height: window.screen.height });
const config = new Config();
config.ready().then(applyConfigOnStartup);

// 启动后根据配置恢复系统能力（开机自启）
async function applyConfigOnStartup() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_autostart", { enable: config.get("autostart") });
  } catch (e) {
    // 非 Tauri 环境忽略
  }
}

// 托盘菜单"设置"切换：由 Rust 侧 emit 事件到前端处理
async function onConfigToggle(key) {
  if (key === "toggle_follow") {
    await config.set("followMouse", !config.get("followMouse"));
  } else if (key === "toggle_mute") {
    await config.set("muted", !config.get("muted"));
  } else if (key === "toggle_autostart") {
    const v = !config.get("autostart");
    await config.set("autostart", v);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_autostart", { enable: v });
    } catch (e) {
      // 忽略
    }
  }
}

// 注册托盘设置切换事件监听（避免顶层 await，兼容 es2021 构建目标）
async function setupTrayEvents() {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("config-toggle", (e) => onConfigToggle(e.payload));
  } catch (e) {
    // 非 Tauri 环境忽略
  }
}
setupTrayEvents();

// ===== 交互：拖拽 / 点击反馈 =====
// 窗口尺寸=宠物，正常接收鼠标。macOS 上透明无装饰窗的 startDragging 经常失效，
// 因此采用"手动拖拽"：mousedown 记录窗口起点与鼠标起点，mousemove 时用鼠标位移
// 直接 setPosition 移动窗口（delta 方式，逻辑坐标，跨平台可靠）。
// 若鼠标几乎没移动则视为"点击"，播放开心反馈。
let pressing = false;
let dragging = false;
let moved = false;
let downMouse = { x: 0, y: 0 }; // mousedown 时鼠标相对窗口逻辑坐标
let dragStartWin = { x: 0, y: 0 }; // mousedown 时窗口逻辑位置
const DRAG_THRESHOLD = 4; // px

let LogicalPosition = null;
async function getWin() {
  const mod = await import("@tauri-apps/api/window");
  LogicalPosition = mod.LogicalPosition;
  return mod.getCurrentWindow();
}
// 设置窗口逻辑位置（setPosition 需传入 Position 对象，不能传两个数字）
async function setWinPos(x, y) {
  const win = await ensureWin();
  if (!win || !LogicalPosition) return;
  try {
    await win.setPosition(new LogicalPosition(x, y));
  } catch (e) {
    // 忽略
  }
}

canvas.addEventListener("mousedown", async (e) => {
  pressing = true;
  dragging = false;
  moved = false;
  // 用屏幕坐标（e.screenX/Y）记录起点：窗口移动时 clientX 会随窗口偏移，
  // 而 screenX/Y 是绝对屏幕坐标，才能正确计算鼠标位移。
  downMouse = { x: e.screenX, y: e.screenY };
  // 记录当前窗口逻辑位置作为拖拽起点
  try {
    const win = await ensureWin();
    if (win) {
      const pos = await win.outerPosition(); // PhysicalPosition
      const scale = window.devicePixelRatio || 1;
      dragStartWin = { x: pos.x / scale, y: pos.y / scale };
    } else {
      dragStartWin = { x: pet.x, y: pet.y };
    }
  } catch (err) {
    dragStartWin = { x: pet.x, y: pet.y };
  }
});

window.addEventListener("mousemove", (e) => {
  if (!pressing) return;
  const dx = e.screenX - downMouse.x;
  const dy = e.screenY - downMouse.y;
  if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    dragging = true;
    moved = true;
    pet.setState(State.IDLE);
  }
  if (dragging) {
    // 手动跟随：新窗口位置 = 拖拽起点 + 鼠标屏幕位移（逻辑坐标）
    pet.x = dragStartWin.x + dx;
    pet.y = dragStartWin.y + dy;
    setWinPos(pet.x, pet.y);
  }
});

window.addEventListener("mouseup", () => {
  if (!pressing) return;
  if (!moved) {
    pet.triggerHappy(); // 点击反馈
  }
  pressing = false;
  dragging = false;
  moved = false;
});

// 全局鼠标位置（LOOK 注视）：用屏幕坐标，与 pet 的屏幕坐标体系一致
const mouse = { x: null, y: null };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.screenX;
  mouse.y = e.screenY;
});

// 窗口跟随：缓存 win 单例，仅在位置变化 >1px 时 setPosition（去抖，避免每帧 IPC）
let winCache = null;
let lastSet = { x: NaN, y: NaN };
async function ensureWin() {
  if (!winCache) {
    try {
      winCache = await getWin();
    } catch (e) {
      // 忽略
    }
  }
  return winCache;
}

async function followWindow() {
  if (Math.abs(pet.x - lastSet.x) < 1 && Math.abs(pet.y - lastSet.y) < 1) return;
  lastSet.x = pet.x;
  lastSet.y = pet.y;
  setWinPos(pet.x, pet.y);
}

// 主循环：更新宠物 + 把窗口移到宠物位置
const loop = new Loop((dt, now) => {
  if (!dragging) {
    pet.update(dt, mouse, config.get("followMouse"));
  }
  // 无论是否拖拽，都保持窗口位置与 pet.x/pet.y 一致
  followWindow();
  renderer.clear();
  pet.draw(renderer.ctx);
});

// 预热窗口句柄（缓存），使后续 startDragging / setPosition 为同步调用
ensureWin();
loop.start();

// 便于调试
window.__pet = pet;
window.__config = config;
