import { Pet, State } from "./core/Pet.js";
import { Loop } from "./core/Loop.js";
import { Renderer } from "./render/Renderer.js";
import { Config } from "./core/Config.js";

const canvas = document.getElementById("stage");
const renderer = new Renderer(canvas);
const pet = new Pet({ width: renderer.width, height: renderer.height });
const config = new Config();
// 配置异步加载完成前默认允许跟随鼠标
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
    const v = !config.get("followMouse");
    await config.set("followMouse", v);
  } else if (key === "toggle_mute") {
    const v = !config.get("muted");
    await config.set("muted", v);
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

// 监听窗口尺寸变化，同步宠物活动边界
window.addEventListener("resize", () => {
  pet.screen = { width: renderer.width, height: renderer.height };
});

// 鼠标位置（用于 LOOK 注视）
const mouse = { x: null, y: null };
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// ===== 智能穿透 + 拖拽 + 点击反馈 =====
// 默认窗口点击穿透（不挡操作）。按住宠物身体时临时关闭穿透；
// 若移动超过阈值则进入拖拽（移动整个窗口），否则视为"点击"播放开心反馈。
let pressing = false;
let dragging = false;
let downPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 4; // px

async function setIgnore(ignore) {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setIgnoreCursorEvents(ignore);
  } catch (e) {
    // 非 Tauri 环境（纯浏览器预览）静默忽略
  }
}

async function startDrag() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_drag");
  } catch (e) {
    // 忽略
  }
}

function hitPet(x, y) {
  return x >= pet.x && x <= pet.x + pet.size && y >= pet.y && y <= pet.y + pet.size;
}

canvas.addEventListener("mousedown", async (e) => {
  if (hitPet(e.clientX, e.clientY)) {
    pressing = true;
    dragging = false;
    downPos = { x: e.clientX, y: e.clientY };
    // 关闭穿透，确保后续 mousemove / mouseup 能被收到
    await setIgnore(false);
  }
});

window.addEventListener("mousemove", async (e) => {
  if (pressing && !dragging) {
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragging = true;
      pet.setState(State.IDLE); // 拖拽时停下
      await startDrag();
    }
  }
});

window.addEventListener("mouseup", async (e) => {
  if (pressing) {
    if (!dragging) {
      // 视为点击：播放开心反馈
      pet.triggerHappy();
    }
    pressing = false;
    dragging = false;
    // 恢复穿透（不挡操作）
    await setIgnore(true);
  }
});

const loop = new Loop((dt, now) => {
  if (!dragging) pet.update(dt, mouse, config.get("followMouse"));
  renderer.clear();
  pet.draw(renderer.ctx);
});

loop.start();

// 便于调试
window.__pet = pet;
window.__config = config;
