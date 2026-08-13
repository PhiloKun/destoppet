import { Pet, State } from "./core/Pet.js";
import { Loop } from "./core/Loop.js";
import { Renderer } from "./render/Renderer.js";
import { Config } from "./core/Config.js";

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
// 窗口尺寸=宠物，正常接收鼠标。mousedown 命中即开始拖拽（startDragging 由系统接管）；
// 若鼠标几乎没移动则视为"点击"，播放开心反馈。
let pressing = false;
let dragging = false;
let moved = false;
let downPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 4; // px

async function getWin() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

canvas.addEventListener("mousedown", (e) => {
  pressing = true;
  dragging = false;
  moved = false;
  downPos = { x: e.clientX, y: e.clientY };
});

window.addEventListener("mousemove", (e) => {
  if (pressing) {
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragging = true;
      moved = true;
      pet.setState(State.IDLE);
      // 系统接管拖拽（窗口由鼠标移动）。用已缓存的 win 同步调用，
      // 避免在 mousedown 异步链外触发导致失效。
      if (winCache) winCache.startDragging();
    }
  }
});

window.addEventListener("mouseup", async () => {
  if (!pressing) return;
  if (pressing && !moved) {
    pet.triggerHappy(); // 点击反馈
  }
  // 拖拽结束后，把系统移动后的实际窗口位置写回 pet，保持后续跟随一致
  if (dragging) {
    try {
      const win = await ensureWin();
      const pos = await win.outerPosition(); // Physical
      const scale = window.devicePixelRatio || 1;
      pet.x = pos.x / scale;
      pet.y = pos.y / scale;
    } catch (err) {
      // 忽略
    }
  }
  pressing = false;
  dragging = false;
  moved = false;
});

// 全局鼠标位置（LOOK 注视）
const mouse = { x: null, y: null };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
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
  const win = await ensureWin();
  if (!win) return;
  lastSet.x = pet.x;
  lastSet.y = pet.y;
  try {
    await win.setPosition(pet.x, pet.y); // Logical 坐标
  } catch (e) {
    // 忽略
  }
}

// 主循环：更新宠物 + 把窗口移到宠物位置
const loop = new Loop((dt, now) => {
  if (!dragging) {
    pet.update(dt, mouse, config.get("followMouse"));
    followWindow();
  }
  renderer.clear();
  pet.draw(renderer.ctx);
});

// 预热窗口句柄（缓存），使后续 startDragging / setPosition 为同步调用
ensureWin();
loop.start();

// 便于调试
window.__pet = pet;
window.__config = config;
